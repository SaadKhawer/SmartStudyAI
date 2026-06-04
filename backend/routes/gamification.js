const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getProfile, awardXP, getLeaderboard, getBadges } = require('../controllers/gamificationController');

router.get('/profile', authenticate, getProfile);
router.post('/award-xp', authenticate, awardXP);
router.get('/leaderboard', authenticate, getLeaderboard);
router.get('/badges', authenticate, getBadges);

module.exports = router;
