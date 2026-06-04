const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { generatePlan, getCurrentPlan, updateProgress, adjustPlan } = require('../controllers/studyPlanController');

router.post('/generate', authenticate, generatePlan);
router.get('/current', authenticate, getCurrentPlan);
router.put('/progress', authenticate, updateProgress);
router.post('/adjust', authenticate, adjustPlan);

module.exports = router;
