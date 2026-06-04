/**
 * Document Model
 * Stores metadata for uploaded study documents
 */

const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  originalName: { type: String, required: true },
  fileType: {
    type: String,
    enum: ['pdf', 'txt', 'md', 'docx'],
    required: true
  },
  fileSize: { type: Number, required: true }, // bytes
  filePath: { type: String, required: true },
  
  // RAG fields
  textContent: { type: String, default: '' },
  chunks: [{
    id: String,
    text: String,
    metadata: { page: Number, start: Number, end: Number }
  }],
  embeddingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  vectorStoreId: { type: String, default: null }, // FAISS index ID
  chunkCount: { type: Number, default: 0 },
  
  // Metadata
  subject: { type: String, default: 'General' },
  tags: [String],
  summary: { type: String, default: '' },
  pageCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Virtual for file size display
documentSchema.virtual('fileSizeFormatted').get(function() {
  const kb = this.fileSize / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
});

module.exports = mongoose.model('Document', documentSchema);
