/**
 * Auth Controller
 * Handles signup, login, profile management
 */

const { validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * POST /api/auth/signup
 * Register a new user
 */
const signup = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Create user (password hashing handled by model hook)
    const user = await User.create({ name, email, password });
    
    // Generate token
    const token = user.generateAuthToken();
    
    logger.info(`New user registered: ${email}`);
    
    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    logger.error(`Signup error: ${error.message}`);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
};

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user (include password for comparison)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = user.generateAuthToken();
    
    logger.info(`User logged in: ${email}`);
    
    res.json({
      message: 'Login successful!',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

/**
 * GET /api/auth/me
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (error) {
    logger.error(`Get profile error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
};

/**
 * PUT /api/auth/profile
 * Update user preferences and profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, preferences } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (preferences) updates.preferences = { ...req.user.preferences, ...preferences };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({ message: 'Profile updated!', user });
  } catch (error) {
    logger.error(`Update profile error: ${error.message}`);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
};

module.exports = { signup, login, getProfile, updateProfile };
