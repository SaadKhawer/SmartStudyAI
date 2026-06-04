// models/Reminder.js
const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 100 },
  message: { type: String, default: '' },
  reminderTime: { type: Date, required: true },
  repeat: {
    type: String,
    enum: ['none', 'daily', 'weekly'],
    default: 'none'
  },
  subject: { type: String, default: 'General' },
  isActive: { type: Boolean, default: true },
  isFired: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Reminder', reminderSchema);