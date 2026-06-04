/**
 * User Model
 * Handles user data, password hashing, and JWT generation
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Never return password in queries
  },
  avatar: {
    type: String,
    default: null
  },
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
    subject: { type: String, default: 'General' },
    studyGoal: { type: Number, default: 60 } // minutes per day
  },
  stats: {
    totalChats: { type: Number, default: 0 },
    totalDocuments: { type: Number, default: 0 },
    studyStreak: { type: Number, default: 0 },
    lastStudied: { type: Date, default: null }
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null }
}, {
  timestamps: true
});

// ─── Password Hashing Hook ─────────────────────────────────────────────────────
userSchema.pre('save', async function(next) {
  // Only hash if password was modified
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance Methods ──────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { id: this._id, email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
