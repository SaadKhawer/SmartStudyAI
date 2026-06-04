// routes/documents.js
const express = require('express');
const { uploadDocument, getDocuments, getDocument, deleteDocument } = require('../controllers/documentController');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.post('/upload', uploadDocument);
router.get('/', getDocuments);
router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);

module.exports = router;
