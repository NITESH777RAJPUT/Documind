const axios = require('axios');
const fs = require('fs');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const File = require('../models/File');
const { extractStructuredQuery } = require('../utils/parser');
const { searchSimilarChunks } = require('../utils/embedding');
const { evaluateLogic } = require('../utils/logicEvaluator');

const API_KEY = process.env.OPENROUTER_API_KEY;

// ✅ 1. Upload File or Use Saved File and Process Query
exports.handleFileQuery = async (req, res) => {
  const { userQuery, fileId } = req.body;
  const file = req.file || (req.files ? req.files.file : null);

  let documentText = '';
  let structuredQuery = {};
  let matches = [];
  let logicEvaluations = [];
  let fileRecord;

  try {
    // 🆕 CASE 1: New File Upload
    if (file) {
      const filePath = file.path || file.filepath;

      if ((file.mimetype || file.type) === 'application/pdf') {
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        documentText = pdfData.text;
      } else {
        documentText = fs.readFileSync(filePath, 'utf-8');
      }

      structuredQuery = await extractStructuredQuery(documentText);
      matches = await searchSimilarChunks(structuredQuery);
      logicEvaluations = evaluateLogic(structuredQuery);

      // 🗂 Save File
      fileRecord = await File.create({
        userId: req.user.id,
        fileName: file.originalname,
        chatHistory: [{ type: 'user', content: userQuery }],
        structuredQuery,
        topMatches: matches,
        logicEvaluation: logicEvaluations,
      });
    }

    // ♻️ CASE 2: Use Previous File via fileId
    else if (fileId) {
      fileRecord = await File.findById(fileId);
      if (!fileRecord) return res.status(404).json({ error: "File not found" });

      documentText = `
        Structured Query: ${JSON.stringify(fileRecord.structuredQuery)}
        Top Matches: ${JSON.stringify(fileRecord.topMatches)}
        Logic Evaluation: ${JSON.stringify(fileRecord.logicEvaluation)}
      `;

      structuredQuery = fileRecord.structuredQuery;
      matches = fileRecord.topMatches;
      logicEvaluations = fileRecord.logicEvaluation;

      fileRecord.chatHistory.push({ type: 'user', content: userQuery });
      await fileRecord.save();
    }

    else {
      return res.status(400).json({ error: 'No file or fileId provided' });
    }

    // 🧠 Call LLM for response
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'qwen/qwen3-coder:free',
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: `You are a professional assistant.
Answer the query based ONLY on the provided document content or structure.
Be helpful, professional, and avoid repeating the question.`,
          },
          {
            role: 'user',
            content: `Document Content:\n${documentText}\n\nUser Query:\n${userQuery}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const reply = response.data.choices?.[0]?.message?.content || '⚠️ No response from model.';

    // 📝 Update chat history
    if (fileRecord) {
      fileRecord.chatHistory.push({ type: 'bot', content: reply });
      await fileRecord.save();
    }

    res.json({
      response: reply,
      structuredQuery,
      topMatches: matches,
      logicEvaluations,
      fileId: fileRecord?._id, // so frontend can remember
    });

  } catch (err) {
    console.error("❌ handleFileQuery error:", err?.response?.data || err.message);
    res.status(500).json({ error: "Failed to process document query." });
  }
};

// ✅ 2. Summarize Static Document
exports.summarizeDocument = async (req, res) => {
  const filePath = './uploads/sample.txt';

  try {
    const documentText = fs.readFileSync(filePath, 'utf-8');

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'qwen/qwen3-coder:free',
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: `You are a skilled summarizer.
Provide a smooth and informative summary of the document.`,
          },
          {
            role: 'user',
            content: `Document:\n"""${documentText}"""`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const summary = response.data.choices?.[0]?.message?.content || '⚠️ No summary generated.';
    res.json({ summary });

  } catch (err) {
    console.error("❌ summarizeDocument error:", err?.response?.data || err.message);
    res.status(500).json({ error: "Summary generation failed" });
  }
};

// ✅ 3. Get All Uploaded Files for a User
exports.getUserFiles = async (req, res) => {
  try {
    const files = await File.find({ userId: req.params.userId }).sort({ uploadedAt: -1 });
    res.json({ files });
  } catch (err) {
    console.error("❌ getUserFiles error:", err.message);
    res.status(500).json({ error: "Failed to fetch user files" });
  }
};
