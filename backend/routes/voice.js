const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { askQuestion, getFollowUp, endSession } = require('../controllers/voiceController');

router.post('/ask', authenticate, askQuestion);
router.post('/follow-up', authenticate, getFollowUp);
router.post('/end', authenticate, endSession);

module.exports = router;
