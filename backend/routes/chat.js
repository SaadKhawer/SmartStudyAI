// routes/chat.js
const express = require('express');
const { sendMessage, getSessions, getSession, deleteSession, createSession } = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.post('/message', sendMessage);
router.get('/sessions', getSessions);
router.post('/sessions', createSession);
router.get('/sessions/:id', getSession);
router.delete('/sessions/:id', deleteSession);

module.exports = router;
