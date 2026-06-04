/**
 * Document Controller
 * Handles file upload, text extraction, and RAG indexing
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const Document = require('../models/Document');
const User = require('../models/User');
const { indexDocument, generateDocumentSummary, removeDocumentFromIndex } = require('../services/ragService');
const logger = require('../utils/logger');

// ─── Multer Configuration ──────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOADS_DIR, req.user._id.toString());
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
  if (allowed.includes(file.mimetype) || file.originalname.endsWith('.md')) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, TXT, and MD files are supported.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

/**
 * Extract text from uploaded file based on type
 */
async function extractText(filePath, mimeType) {
  if (mimeType === 'application/pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return { text: data.text, pageCount: data.numpages };
  }
  // For TXT and MD files
  const text = fs.readFileSync(filePath, 'utf-8');
  return { text, pageCount: 1 };
}

/**
 * POST /api/documents/upload
 * Upload and process a document for RAG
 */
const uploadDocument = [
  upload.single('document'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { subject = 'General', tags = '' } = req.body;
    
    try {
      const fileExt = path.extname(req.file.originalname).slice(1).toLowerCase();
      const fileType = fileExt === 'txt' ? 'txt' : fileExt === 'md' ? 'md' : 'pdf';

      // Create document record
      const document = await Document.create({
        user: req.user._id,
        name: req.file.originalname.replace(/\.[^/.]+$/, ''),
        originalName: req.file.originalname,
        fileType,
        fileSize: req.file.size,
        filePath: req.file.path,
        subject,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        embeddingStatus: 'processing'
      });

      // Respond immediately, process in background
      res.status(201).json({
        message: 'File uploaded! Processing embeddings...',
        document: {
          _id: document._id,
          name: document.name,
          fileType,
          fileSize: req.file.size,
          embeddingStatus: 'processing'
        }
      });

      // ─── Background Processing ───────────────────────────────────────────────
      (async () => {
        try {
          // Extract text
          const { text, pageCount } = await extractText(req.file.path, req.file.mimetype);
          
          if (!text || text.trim().length < 50) {
            await Document.findByIdAndUpdate(document._id, {
              embeddingStatus: 'failed',
              textContent: text || ''
            });
            return;
          }

          // Generate AI summary
          const summary = await generateDocumentSummary(text);

          // Index in vector store (RAG)
          const { chunkCount } = await indexDocument(
            req.user._id.toString(),
            document._id.toString(),
            document.name,
            text
          );

          // Update document with results
          await Document.findByIdAndUpdate(document._id, {
            textContent: text,
            pageCount,
            summary,
            chunkCount,
            embeddingStatus: 'completed'
          });

          // Update user stats
          await User.findByIdAndUpdate(req.user._id, {
            $inc: { 'stats.totalDocuments': 1 }
          });

          logger.info(`✅ Document ${document._id} processed: ${chunkCount} chunks`);
        } catch (bgError) {
          logger.error(`Background processing error: ${bgError.message}`);
          await Document.findByIdAndUpdate(document._id, {
            embeddingStatus: 'failed'
          });
        }
      })();

    } catch (error) {
      // Cleanup uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      logger.error(`Upload error: ${error.message}`);
      res.status(500).json({ error: 'Failed to upload document.' });
    }
  }
];

/**
 * GET /api/documents
 * Get all documents for the current user
 */
const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ user: req.user._id })
      .select('-textContent -chunks') // Exclude heavy fields
      .sort({ createdAt: -1 });

    res.json({ documents });
  } catch (error) {
    logger.error(`Get documents error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
};

/**
 * GET /api/documents/:id
 * Get a specific document
 */
const getDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user._id
    }).select('-textContent -chunks');

    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    res.json({ document });
  } catch (error) {
    logger.error(`Get document error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch document.' });
  }
};

/**
 * DELETE /api/documents/:id
 * Delete a document and remove from vector store
 */
const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Remove from filesystem
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    // Remove from vector store
    await removeDocumentFromIndex(req.user._id.toString(), document._id.toString());

    // Delete from DB
    await document.deleteOne();

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalDocuments': -1 }
    });

    res.json({ message: 'Document deleted successfully.' });
  } catch (error) {
    logger.error(`Delete document error: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
};

module.exports = { uploadDocument, getDocuments, getDocument, deleteDocument };
