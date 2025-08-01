// backend/models/File.js
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: String,
  pdfUrl: String, // ✅ NEW: Field to store the URL of the PDF if it was a URL upload
  chatHistory: [
    {
      type: { type: String }, // 'user' or 'bot'
      content: String,
    },
  ],
  structuredQuery: Object,
  topMatches: Array,
  logicEvaluation: Array,
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('File', fileSchema);