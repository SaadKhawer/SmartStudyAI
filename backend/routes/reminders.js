// routes/reminders.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Reminder = require('../models/Reminder');

// GET all reminders
router.get('/', authenticate, async (req, res) => {
  try {
    const reminders = await Reminder.find({
      user: req.user._id,
      isActive: true
    }).sort({ reminderTime: 1 });
    res.json({ reminders });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// POST create reminder
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, message, reminderTime, repeat, subject } = req.body;
    if (!title || !reminderTime) {
      return res.status(400).json({ error: 'Title and time required' });
    }
    const reminder = await Reminder.create({
      user: req.user._id,
      title, message, reminderTime, repeat, subject
    });
    res.status(201).json({ reminder });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// DELETE reminder
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Reminder.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isActive: false }
    );
    res.json({ message: 'Reminder deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// GET upcoming reminders (for notifications)
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const reminders = await Reminder.find({
      user: req.user._id,
      isActive: true,
      isFired: false,
      reminderTime: { $gte: now, $lte: next24h }
    });
    res.json({ reminders });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch upcoming reminders' });
  }
});

module.exports = router;