// routes/dashboard.js
const express = require('express');
const { getStats, getRecommendations } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.get('/stats', getStats);
router.get('/recommendations', getRecommendations);

module.exports = router;
