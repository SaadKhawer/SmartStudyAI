const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getAnalysis, getStrategies, recordResult } = require('../controllers/weaknessController');

router.get('/analysis', authenticate, getAnalysis);
router.get('/strategies', authenticate, getStrategies);
router.post('/record', authenticate, recordResult);

module.exports = router;
