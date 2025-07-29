const express = require('express');
const router = express.Router();
const multer = require('multer');
const { handleFileQuery, summarizeDocument, getUserFiles } = require('../controllers/openRouterController');
const { requireAuth } = require('../middlewares/authMiddleware'); // ✅ Add this line

// Store uploaded files in the 'uploads' directory
const upload = multer({ dest: 'uploads/' });

// ✅ POST: Upload file + query => answer + structured data (auth + file upload)
router.post('/file-query', requireAuth, upload.single('file'), handleFileQuery);

// ✅ GET: Return a summary of default document (sample.txt or dynamic)
router.get('/summarize', summarizeDocument);

// ✅ NEW: Get all saved files by user ID
router.get('/files/:userId', getUserFiles);

module.exports = router;
