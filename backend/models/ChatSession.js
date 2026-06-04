/**
 * Chat Session Model
 * Stores conversation history per user
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  imageUrl: { type: String },
  sources: [{
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    documentName: String,
    chunk: String,
    relevanceScore: Number
  }],
  timestamp: { type: Date, default: Date.now }
});

const chatSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'New Conversation',
    maxlength: 100
  },
  messages: [messageSchema],
  documentsUsed: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  isActive: { type: Boolean, default: true },
  messageCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Auto-generate title from first message
chatSessionSchema.pre('save', function(next) {
  if (this.messages.length > 0 && this.title === 'New Conversation') {
    const firstUserMsg = this.messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      this.title = firstUserMsg.content.substring(0, 60) +
        (firstUserMsg.content.length > 60 ? '...' : '');
    }
  }
  this.messageCount = this.messages.length;
  next();
});

module.exports = mongoose.model('ChatSession', chatSessionSchema);
