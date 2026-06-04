# 📚 StudyAI — Smart AI Study Assistant
### Full-Stack RAG Application | Grok (xAI) + HuggingFace + FAISS + React + Express + MongoDB

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BROWSER  (React 18)                          │
│   Login/Signup → Dashboard → AI Chat (RAG) → Documents → Settings   │
│   Dark/Light mode · Markdown rendering · Source citations            │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  REST / JSON  (JWT in Authorization header)
┌──────────────────────────▼───────────────────────────────────────────┐
│                    BACKEND  (Node.js + Express)                      │
│                                                                      │
│  /api/auth        /api/chat        /api/documents    /api/dashboard  │
│  signup/login     send message     upload PDF        stats + recs    │
│  JWT + bcrypt     session history  pdf-parse + RAG                   │
│                                                                      │
│  ┌─────────────────────── RAG SERVICE ──────────────────────────┐    │
│  │                                                               │    │
│  │  INGEST:  PDF → pdf-parse → RecursiveTextSplitter            │    │
│  │           → 1 000-char chunks (200 overlap)                   │    │
│  │           → HuggingFace embed (all-MiniLM-L6-v2, 384-dim)   │    │
│  │           → FAISS index  (per-user, saved to disk)           │    │
│  │                                                               │    │
│  │  QUERY:   user message → HuggingFace embed                   │    │
│  │           → FAISS similaritySearch (top-5, L2 < 1.2)        │    │
│  │           → inject chunks into system prompt                 │    │
│  │           → Grok (xAI) grok-3-mini → cited answer           │    │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │  MongoDB                │  ← Users, ChatSessions, Documents
              │  FAISS (local disk)     │  ← vector_stores/<userId>/
              └─────────────────────────┘
```

### Why Grok for LLM + HuggingFace for embeddings?
- **Grok (xAI)** — xAI's API is 100% OpenAI-SDK compatible (just swap `baseURL`). Fast, capable, competitive pricing.
- **HuggingFace Inference API** — free tier, no credit card. `all-MiniLM-L6-v2` produces 384-dim embeddings suitable for semantic search.
- **FAISS** — Facebook's Approximate Nearest Neighbour library. Runs locally, zero cost, production-grade speed.

---

## 📂 Folder Structure

```
studyai/
├── docker-compose.yml
├── README.md
│
├── backend/
│   ├── server.js                  ← Express entry, middleware, routes
│   ├── package.json
│   ├── Dockerfile
│   ├── .env.example               ← copy → .env and fill keys
│   │
│   ├── controllers/
│   │   ├── authController.js      ← signup, login, profile
│   │   ├── chatController.js      ← sessions, sendMessage (calls RAG)
│   │   ├── documentController.js  ← upload, list, delete (calls RAG indexer)
│   │   └── dashboardController.js ← stats, AI recommendations
│   │
│   ├── middleware/
│   │   └── auth.js                ← JWT verify middleware
│   │
│   ├── models/
│   │   ├── User.js                ← bcrypt, JWT, preferences
│   │   ├── ChatSession.js         ← message history, source citations
│   │   └── Document.js            ← file metadata, embedding status
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── chat.js
│   │   ├── documents.js
│   │   └── dashboard.js
│   │
│   ├── services/
│   │   └── ragService.js          ← CORE: embed, FAISS, Grok LLM
│   │
│   ├── utils/
│   │   └── logger.js              ← Winston logger
│   │
│   ├── uploads/                   ← uploaded files (gitignored)
│   └── vector_stores/             ← FAISS indexes per user (gitignored)
│
└── frontend/
    ├── package.json
    ├── Dockerfile
    ├── nginx.conf                 ← SPA routing for production
    ├── .env.example
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js                 ← BrowserRouter, providers, protected routes
        ├── index.js
        ├── styles/
        │   └── globals.css        ← CSS variables (dark/light), all components
        ├── contexts/
        │   ├── AuthContext.js     ← global auth state + JWT storage
        │   └── ThemeContext.js    ← dark/light mode + localStorage
        ├── services/
        │   └── api.js             ← Axios instance + auth interceptor
        ├── components/
        │   └── Layout/
        │       ├── Sidebar.js
        │       └── AppLayout.js
        └── pages/
            ├── LoginPage.js
            ├── SignupPage.js
            ├── DashboardPage.js   ← stats, recent sessions, recommendations
            ├── ChatPage.js        ← full chat UI, RAG toggle, source tags
            ├── DocumentsPage.js   ← dropzone upload, processing status
            └── SettingsPage.js    ← profile, theme, subject preference
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites
| Tool | Version |
|------|---------|
| Node.js | 18 + |
| MongoDB | 6 + (or Atlas free tier) |
| npm | 9 + |

### Step 1 — Get your API Keys

| Key | Where to get it | Cost |
|-----|----------------|------|
| `GROK_API_KEY` | [console.x.ai](https://console.x.ai) → API Keys | Pay-per-token |
| `HUGGINGFACE_API_KEY` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | **Free** |

### Step 2 — Clone & install

```bash
git clone https://github.com/your-username/studyai.git
cd studyai

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 3 — Configure environment

```bash
# Backend
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/studyai
JWT_SECRET=your_random_32_char_secret_here
GROK_API_KEY=xai-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROK_MODEL=grok-3-mini
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:3000
```

```bash
# Frontend
cd ../frontend
cp .env.example .env
# REACT_APP_API_URL=http://localhost:5000/api  (already set)
```

### Step 4 — Start MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB

# Or use Atlas (no local install needed)
```

### Step 5 — Run the app

```bash
# Terminal 1 — Backend
cd backend
npm run dev          # nodemon → auto-restarts on changes
# ✅ Server on http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm start            # CRA dev server
# ✅ App on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) → Sign up → Upload a PDF → Chat!

---

## 🐳 Docker (One Command)

```bash
# 1. Copy env files
cp backend/.env.example backend/.env
# Fill in GROK_API_KEY and HUGGINGFACE_API_KEY in backend/.env

# 2. Start everything
docker compose up --build

# App:     http://localhost:3000
# API:     http://localhost:5000
# MongoDB: localhost:27017
```

---

## 🔑 How RAG Works (Plain English)

```
📄 You upload "Physics Notes.pdf"
       ↓
📝 Text extracted with pdf-parse
       ↓
✂️  Split into ~100 chunks of 1,000 chars (200 char overlap to preserve context)
       ↓
🔢  Each chunk embedded by HuggingFace → 384-number vector
       ↓
💾  Vectors stored in your personal FAISS index (saved to disk)

──────────────────────────────────────────────

❓ You ask: "What is Newton's second law?"
       ↓
🔢  Question embedded → 384-number vector
       ↓
🔍  FAISS finds top-5 most similar chunks from your documents
       ↓
📋  Chunks injected into Grok's system prompt:
    "Here are relevant sections from the student's notes: [chunk1] [chunk2] ..."
       ↓
🤖  Grok (grok-3-mini) generates answer, citing document names
       ↓
💬  Answer shown with 📎 source tags in the chat UI
```

---

## 🔐 Security Checklist

- ✅ Passwords hashed with **bcrypt** (12 salt rounds)
- ✅ **JWT** tokens (7-day expiry, signed with strong secret)
- ✅ **Helmet.js** — sets 11 security HTTP headers
- ✅ **CORS** restricted to `FRONTEND_URL`
- ✅ **Rate limiting** — 100 req/15min global, 20 req/min for AI routes
- ✅ **Input validation** with express-validator
- ✅ **File type + size** whitelisting on upload (PDF/TXT/MD, 20 MB max)
- ✅ User-scoped file storage and vector stores (users can't access each other's data)
- ✅ Passwords excluded from all API responses (`select: false`)
- ✅ Environment variables — no secrets in code

---

## 🚀 Deployment

### Backend → Railway / Render / Fly.io

```bash
# Railway (easiest)
npm install -g @railway/cli
railway login
railway init
railway up

# Set environment variables in Railway dashboard
# Add MongoDB: use Railway's MongoDB plugin or Atlas
```

### Frontend → Vercel

```bash
npm install -g vercel
cd frontend
vercel

# Set environment variable:
# REACT_APP_API_URL = https://your-backend.railway.app/api
```

### Environment variables to set in production

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Strong random 32+ char string |
| `GROK_API_KEY` | Your xAI key |
| `GROK_MODEL` | `grok-3-mini` or `grok-3` |
| `HUGGINGFACE_API_KEY` | Your HF token |
| `FRONTEND_URL` | Your Vercel URL |

---

## 📡 API Reference

### Auth
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/api/auth/signup` | `{name, email, password}` | ❌ |
| POST | `/api/auth/login` | `{email, password}` | ❌ |
| GET | `/api/auth/me` | — | ✅ |
| PUT | `/api/auth/profile` | `{name, preferences}` | ✅ |

### Chat
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/api/chat/message` | `{message, sessionId?, useDocuments}` | ✅ |
| GET | `/api/chat/sessions` | — | ✅ |
| GET | `/api/chat/sessions/:id` | — | ✅ |
| POST | `/api/chat/sessions` | `{title}` | ✅ |
| DELETE | `/api/chat/sessions/:id` | — | ✅ |

### Documents
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/api/documents/upload` | `multipart/form-data` | ✅ |
| GET | `/api/documents` | — | ✅ |
| DELETE | `/api/documents/:id` | — | ✅ |

### Dashboard
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/dashboard/stats` | ✅ |
| GET | `/api/dashboard/recommendations` | ✅ |

---

## 📈 Scaling Guide (Production)

### Current Architecture (Monolith — good up to ~10k users)
```
1 Express server → MongoDB → FAISS on local disk
```

### Phase 2 — Horizontal Scaling (~10k–100k users)

**1. Persist FAISS to object storage (S3 / Cloudflare R2)**
```js
// After vectorStore.save(localPath) → upload to S3
await s3.putObject({ Bucket: 'studyai-vectors', Key: `${userId}.faiss`, Body: fs.readFileSync(localPath) });
// On load → download from S3 if not cached locally
```

**2. Redis for session caching & rate limiting**
```bash
npm install ioredis connect-redis express-rate-limit-redis
```
```js
// Replace in-process storeCache with Redis
await redis.set(`vector:${userId}`, JSON.stringify(vectorData), 'EX', 3600);
```

**3. Queue document processing with BullMQ**
```bash
npm install bullmq
```
```js
// In documentController: add job to queue instead of inline processing
await embeddingQueue.add('embed', { userId, documentId, filePath });
// Separate worker process handles indexing — doesn't block HTTP responses
```

**4. Separate embedding service**
```
HTTP Request → Express → BullMQ → Embedding Worker (dedicated Node process)
                                   ↓
                               HuggingFace API / local model (Ollama)
```

### Phase 3 — Enterprise (~100k+ users)

| Concern | Solution |
|---------|---------|
| Vector DB | Replace FAISS with **Pinecone** / **Weaviate** / **Qdrant** (managed, scalable) |
| LLM fallback | Add **model routing** — Grok for complex, cheaper model for simple queries |
| Auth | Add **OAuth** (Google, GitHub) via Passport.js |
| Files | **S3** for uploads + **CloudFront** CDN |
| Observability | **Langfuse** / **LangSmith** for LLM tracing and cost monitoring |
| API Gateway | **Kong** or **AWS API Gateway** for rate limiting, auth, versioning |
| Microservices | Split: Auth Service · Chat Service · Document Service · AI Service |

### Performance Quick Wins
```js
// 1. MongoDB indexes (add to models)
chatSessionSchema.index({ user: 1, updatedAt: -1 });
documentSchema.index({ user: 1, embeddingStatus: 1 });

// 2. Response compression
npm install compression
app.use(compression());

// 3. Cache dashboard stats in Redis (5 min TTL)
const cached = await redis.get(`stats:${userId}`);
if (cached) return res.json(JSON.parse(cached));

// 4. Pagination on chat sessions
const sessions = await ChatSession.find(...).limit(20).skip(page * 20);

// 5. Stream Grok responses (server-sent events)
const stream = await grok.chat.completions.create({ ..., stream: true });
for await (const chunk of stream) res.write(chunk.choices[0]?.delta?.content || '');
```

---

## 🤖 Grok Models Reference

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|---------|
| `grok-3-mini` | ⚡ Fast | Good | 💚 Cheap | Dev, Q&A, summaries |
| `grok-3` | Medium | Excellent | 💛 Moderate | Complex reasoning |
| `grok-2` | Fast | Good | 💚 Cheap | Legacy fallback |

Set in `.env`:
```env
GROK_MODEL=grok-3-mini   # recommended to start
```

---

## 🔧 Troubleshooting

| Problem | Fix |
|---------|-----|
| `GROK_API_KEY` errors | Check key at [console.x.ai](https://console.x.ai), ensure credits |
| HuggingFace 503 | Model is loading (cold start) — retry after 20 seconds |
| `faiss-node` install fails | Run `npm install --build-from-source` or use pre-built: `npm install faiss-node --ignore-scripts` |
| CORS errors | Set `FRONTEND_URL=http://localhost:3000` in backend `.env` |
| MongoDB connection refused | Ensure `mongod` is running: `brew services start mongodb-community` |
| PDF text empty | Some scanned PDFs have no extractable text — use OCR tool first |
| Chat works but no sources | HUGGINGFACE_API_KEY not set — hash embeddings give poor retrieval |

---

## 🧪 Test API with cURL

```bash
# 1. Sign up
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"password123"}'

# Save the token from response, then:
TOKEN="eyJhbGci..."

# 2. Send a chat message
curl -X POST http://localhost:5000/api/chat/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the Pythagorean theorem?","useDocuments":false}'

# 3. Upload a document
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "document=@/path/to/notes.pdf" \
  -F "subject=Mathematics"

# 4. Get dashboard stats
curl http://localhost:5000/api/dashboard/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🎓 Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + React Router 6 | SPA with protected routes |
| Styling | Pure CSS Variables | Dark/light theme, zero deps |
| HTTP | Axios | API calls with JWT interceptor |
| Markdown | react-markdown + remark-gfm | Render AI responses beautifully |
| Backend | Node.js + Express 4 | REST API |
| Auth | JWT + bcryptjs | Stateless auth, secure passwords |
| Database | MongoDB + Mongoose | Users, chats, document metadata |
| LLM | Grok (xAI) via openai SDK | AI chat generation |
| Embeddings | HuggingFace Inference API | Convert text to vectors |
| Vector DB | FAISS (faiss-node) | Similarity search |
| Chunking | LangChain TextSplitters | Smart document chunking |
| Upload | Multer | Multipart file handling |
| PDF | pdf-parse | Text extraction |
| Logging | Winston | Structured logs |
| Security | Helmet + express-rate-limit | HTTP security + rate limiting |
| Container | Docker + nginx | Production packaging |
