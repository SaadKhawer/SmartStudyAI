/**
 * RAG Service — Retrieval-Augmented Generation
 * ─────────────────────────────────────────────
 * LLM   : Grok (xAI) via OpenAI-compatible SDK  →  https://api.groq.com/openai/v1
 * Embed : HuggingFace Inference API (free)       →  all-MiniLM-L6-v2
 *         Falls back to deterministic hash-embed for local dev if no HF key.
 * Store : FAISS (per-user, persisted to disk)
 *
 * Flow:
 *  INGEST  → chunk → embed → FAISS save
 *  QUERY   → embed query → FAISS similarity search → inject context → Grok → answer
 */

const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { FaissStore } = require('@langchain/community/vectorstores/faiss');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// ─── Grok client (OpenAI-SDK, different baseURL) ─────────────────────────────
const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// ─── FAISS store directory ────────────────────────────────────────────────────
const VECTOR_STORES_DIR = path.join(__dirname, '../vector_stores');
if (!fs.existsSync(VECTOR_STORES_DIR)) fs.mkdirSync(VECTOR_STORES_DIR, { recursive: true });

// In-process cache — avoids reloading FAISS index on every request
const storeCache = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDING LAYER
// ─────────────────────────────────────────────────────────────────────────────
// Primary  : HuggingFace Inference API (free, sign up at huggingface.co)
//            Model : sentence-transformers/all-MiniLM-L6-v2  (384-dim)
// Fallback : Deterministic hash embedding  (dev only — no semantic meaning!)
// ─────────────────────────────────────────────────────────────────────────────

const HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const EMBED_DIM = 384;

async function embedText(text) {
  const input = text.substring(0, 512); // model token limit

  // ── Option A: HuggingFace Inference API ──────────────────────────────────
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${HF_MODEL}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: input }),
        }
      );
      if (!res.ok) throw new Error(`HF API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      // Response: number[] or number[][] (batch)
      return Array.isArray(data[0]) ? data[0] : data;
    } catch (err) {
      logger.warn(`HuggingFace embed error (${err.message}) — falling back to hash embed`);
    }
  }

  // ── Option B: Hash-based pseudo-embedding (dev fallback) ─────────────────
  logger.warn('No HUGGINGFACE_API_KEY set. Using hash-based embedding (no semantic search).');
  const vec = new Array(EMBED_DIM).fill(0);
  const words = input.toLowerCase().split(/\W+/).filter(Boolean);
  for (const word of words) {
    let h = 5381;
    for (let i = 0; i < word.length; i++) h = ((h << 5) + h) ^ word.charCodeAt(i);
    vec[Math.abs(h) % EMBED_DIM] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

/**
 * LangChain-compatible embeddings class wrapping embedText()
 */
class LocalEmbeddings {
  async embedDocuments(texts) {
    const vecs = [];
    for (const t of texts) vecs.push(await embedText(t));
    return vecs;
  }
  async embedQuery(text) {
    return embedText(text);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEXING
// ─────────────────────────────────────────────────────────────────────────────

async function chunkText(text, metadata = {}) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });
  return splitter.createDocuments([text], [metadata]);
}

/**
 * Index a document into this user's FAISS vector store.
 */
async function indexDocument(userId, documentId, documentName, text) {
  logger.info(`Indexing "${documentName}" for user ${userId}`);

  const chunks = await chunkText(text, {
    documentId: documentId.toString(),
    documentName,
    source: documentName,
  });

  logger.info(`  → ${chunks.length} chunks`);

  const embeddings = new LocalEmbeddings();
  const storePath = path.join(VECTOR_STORES_DIR, userId.toString());

  let vectorStore;
  if (storeCache.has(userId)) {
    vectorStore = storeCache.get(userId);
    await vectorStore.addDocuments(chunks);
  } else if (fs.existsSync(storePath)) {
    vectorStore = await FaissStore.load(storePath, embeddings);
    await vectorStore.addDocuments(chunks);
    storeCache.set(userId, vectorStore);
  } else {
    vectorStore = await FaissStore.fromDocuments(chunks, embeddings);
    storeCache.set(userId, vectorStore);
  }

  await vectorStore.save(storePath);
  logger.info(`  ✅ Indexed and persisted`);
  return { success: true, chunkCount: chunks.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRIEVAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve top-k relevant chunks for a natural-language query.
 */
async function retrieveRelevantChunks(userId, query, topK = 5) {
  const embeddings = new LocalEmbeddings();
  const storePath = path.join(VECTOR_STORES_DIR, userId.toString());

  let vectorStore;
  if (storeCache.has(userId)) {
    vectorStore = storeCache.get(userId);
  } else if (fs.existsSync(storePath)) {
    vectorStore = await FaissStore.load(storePath, embeddings);
    storeCache.set(userId, vectorStore);
  } else {
    return []; // No documents indexed yet
  }

  // Fetch active document IDs for this user from MongoDB
  const Document = require('../models/Document');
  const activeDocs = await Document.find({ user: userId }).select('_id');
  const activeDocIds = new Set(activeDocs.map(d => d._id.toString()));

  // FAISS returns L2 distances (lower = more similar)
  const results = await vectorStore.similaritySearchWithScore(query, topK);
  const THRESHOLD = 1.2;

  return results
    .filter(([, score]) => score < THRESHOLD)
    .map(([doc, score]) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      relevanceScore: parseFloat((1 - score / 2).toFixed(3)),
    }))
    .filter(chunk => activeDocIds.has(chunk.metadata.documentId));
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATION  (Grok LLM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full RAG pipeline:
 *   retrieve context → build prompt → call Grok → return cited answer
 *
 * @param {string}  userId
 * @param {string}  query
 * @param {Array}   chatHistory   [{role, content}]
 * @param {boolean} useDocuments
 */
async function generateRAGResponse(userId, query, chatHistory = [], useDocuments = true) {

  // Step 1 — Retrieve context
  let retrievedChunks = [];
  let contextText = '';

  if (useDocuments) {
    try {
      retrievedChunks = await retrieveRelevantChunks(userId, query, 5);
    } catch (err) {
      logger.warn(`Retrieval skipped: ${err.message}`);
    }

    if (retrievedChunks.length > 0) {
      contextText = retrievedChunks
        .map((c, i) => `[Source ${i + 1} — ${c.metadata.documentName}]\n${c.content}`)
        .join('\n\n---\n\n');
    }
  }

  // Step 2 — System prompt
  const baseSystemPrompt = `Act as an advanced AI-powered learning assistant integrated into a student study app.

Your responsibilities include the following modules:

1. Smart Study Planner:
- Take student subjects, topics, study hours, and deadlines as input
- Generate a personalized daily and weekly timetable
- Prioritize weak and difficult topics
- Include revision sessions and buffer time
- Adjust plan dynamically based on progress

2. Weakness Analyzer:
- Analyze quiz results, test scores, and topic-wise performance
- Identify weak and strong areas
- Highlight topics needing urgent attention
- Suggest specific improvement strategies

3. Gamification System:
- Assign XP points based on completed tasks, quizzes, and study time
- Create levels and progression system
- Award badges for achievements (streaks, high scores, consistency)
- Maintain leaderboard ranking logic

4. Study Group / Collaboration:
- Generate quiz battles based on shared topics
- Suggest group discussion questions
- Enable shared goals and collaborative challenges
- Encourage both cooperative and competitive learning

5. Voice Learning Mode:
- Respond as a voice-friendly tutor (simple, clear explanations)
- Convert student questions into easy-to-understand answers
- Ask follow-up questions to test understanding
- Keep tone conversational and engaging

General Instructions:
- Keep responses structured, clear, and actionable
- Personalize output based on student performance and behavior
- Be concise but helpful
- Focus on improving learning efficiency and engagement
- Use Markdown formatting for clarity.`;

  const systemPrompt = contextText
    ? `${baseSystemPrompt}

STUDY MATERIALS:
${contextText}

ADDITIONAL RULES FOR THIS QUERY:
• Ground your answer in the provided materials. Cite the document name when referencing specific facts.
• If the materials don't fully cover the question, say so and supplement with your own knowledge.`
    : `${baseSystemPrompt}

ADDITIONAL RULES FOR THIS QUERY:
• Note: no study documents are uploaded yet, so you are relying on general knowledge.`;

  // Step 3 — Build message array (system + history + query)
  const messages = [{ role: 'system', content: systemPrompt }];

  chatHistory.slice(-10).forEach(m => {
    if (m.role === 'user' || m.role === 'assistant') {
      messages.push({ role: m.role, content: m.content });
    }
  });

  messages.push({ role: 'user', content: query });

  // Step 4 — Call Grok
  const model = process.env.GROK_MODEL || 'grok-3-mini';

  const tools = [
    {
      type: 'function',
      function: {
        name: 'generate_image',
        description: 'Generate an image based on a prompt. Use this ONLY when the user explicitly asks to generate, draw, or create a picture/image.',
        parameters: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'A detailed prompt describing the image to generate.'
            }
          },
          required: ['prompt']
        }
      }
    }
  ];

  const completion = await grok.chat.completions.create({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 1500,
    tools,
    tool_choice: 'auto'
  });

  const responseMessage = completion.choices[0].message;
  let finalAnswer = responseMessage.content;
  let imageUrl = null;

  if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    const toolCall = responseMessage.tool_calls[0];
    if (toolCall.function.name === 'generate_image') {
      const args = JSON.parse(toolCall.function.arguments);
      try {
        logger.info(`Generating image for prompt: ${args.prompt}`);
        
        // Use Pollinations API as the primary free image generator
        const generatedImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(args.prompt)}?nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
        
        const imgRes = await fetch(generatedImageUrl);
        
        if (!imgRes.ok) {
           if (imgRes.status === 429) {
             throw new Error("The free image generation service is currently busy due to high traffic. Please try again in a minute!");
           }
           throw new Error(`Image service returned an error (${imgRes.status}).`);
        }

        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        
        imageUrl = `data:image/jpeg;base64,${base64Data}`;
        finalAnswer = `Here is the image you requested for: "${args.prompt}"`;
      } catch (err) {
        logger.error(`Image generation failed: ${err.message}`);
        finalAnswer = `I'm sorry, but I failed to generate the image. ${err.message}`;
      }
    }
  }

  return {
    answer: finalAnswer,
    imageUrl: imageUrl,
    sources: retrievedChunks.map(c => ({
      documentName: c.metadata.documentName,
      documentId: c.metadata.documentId,
      chunk: c.content.substring(0, 200) + '…',
      relevanceScore: c.relevanceScore,
    })),
    hasContext: retrievedChunks.length > 0,
    tokensUsed: completion.usage?.total_tokens || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARISATION
// ─────────────────────────────────────────────────────────────────────────────

async function generateDocumentSummary(text) {
  try {
    const completion = await grok.chat.completions.create({
      model: process.env.GROK_MODEL || 'grok-3-mini',
      temperature: 0.3,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Summarise this study material in 2–3 sentences, highlighting the main topics:\n\n${text.substring(0, 3000)}`,
      }],
    });
    return completion.choices[0].message.content;
  } catch (err) {
    logger.error(`Summary generation failed: ${err.message}`);
    return 'Summary not available.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

async function removeDocumentFromIndex(userId) {
  storeCache.delete(userId.toString());
  logger.info(`Vector store cache cleared for user ${userId}`);
}

module.exports = {
  indexDocument,
  retrieveRelevantChunks,
  generateRAGResponse,
  generateDocumentSummary,
  removeDocumentFromIndex,
};
