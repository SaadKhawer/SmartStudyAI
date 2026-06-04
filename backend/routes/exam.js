// routes/exam.js
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  startExam, submitAnswer, getHint, getExamDocuments
} = require('../controllers/examController');

router.use(authenticate);

router.post('/start',     startExam);
router.post('/answer',    submitAnswer);
router.post('/hint',      getHint);
router.get('/documents',  getExamDocuments);

module.exports = router;
