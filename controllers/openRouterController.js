const axios = require('axios');
const fs = require('fs');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const File = require('../models/File');
const { extractStructuredQuery } = require('../utils/parser');
const { searchSimilarChunks } = require('../utils/embedding');
const { evaluateLogic } = require('../utils/logicEvaluator');

const API_KEY = process.env.OPENROUTER_API_KEY;

/**
 * Handles file uploads or PDF URLs, processes the document with LLMs,
 * and returns structured data and an AI-generated JSON response.
 */
exports.handleFileQuery = async (req, res) => {
  const { userQuery, fileId, pdfUrl } = req.body; // ✅ NEW: Add pdfUrl
  const file = req.file || (req.files ? req.files.file : null);

  let documentText = '';
  let structuredQuery = {};
  let matches = [];
  let logicEvaluations = [];
  let fileRecord;
  let fileName;

  try {
    // 🆕 CASE 1: New File Upload or PDF URL
    if (file || pdfUrl) {
      if (pdfUrl) {
        // ✅ NEW: Logic to handle a PDF URL
        try {
          // Fetch the content from the URL
          const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
          if (response.headers['content-type'] === 'application/pdf') {
            const pdfData = await pdfParse(response.data);
            documentText = pdfData.text;
            fileName = pdfUrl.substring(pdfUrl.lastIndexOf('/') + 1); // Extract filename
          } else {
            // Assume it's a text file if not a PDF
            documentText = response.data.toString('utf-8');
            fileName = pdfUrl.substring(pdfUrl.lastIndexOf('/') + 1);
          }
        } catch (downloadErr) {
          console.error("❌ Failed to fetch or parse PDF from URL:", downloadErr.message);
          return res.status(400).json({ error: "Failed to fetch or parse PDF from provided URL." });
        }
      } else {
        // Existing file upload logic
        const filePath = file.path || file.filepath;
        if ((file.mimetype || file.type) === 'application/pdf') {
          const pdfBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(pdfBuffer);
          documentText = pdfData.text;
        } else {
          documentText = fs.readFileSync(filePath, 'utf-8');
        }
        fileName = file.originalname;
      }

      structuredQuery = await extractStructuredQuery(documentText);
      matches = await searchSimilarChunks(structuredQuery);
      logicEvaluations = evaluateLogic(structuredQuery);

      // 🗂 Save File to database
      fileRecord = await File.create({
        userId: req.user.id,
        fileName: fileName,
        chatHistory: [{ type: 'user', content: userQuery }],
        structuredQuery,
        topMatches: matches,
        logicEvaluation: logicEvaluations,
        pdfUrl: pdfUrl, // ✅ NEW: Save the PDF URL to the file record
      });
    }

    // ♻️ CASE 2: Use Previous File via fileId
    else if (fileId) {
      fileRecord = await File.findById(fileId);
      if (!fileRecord) return res.status(404).json({ error: "File not found" });

      // Add file-specific context for the LLM
      documentText = `
        Structured Query: ${JSON.stringify(fileRecord.structuredQuery)}
        Top Matches: ${JSON.stringify(fileRecord.topMatches)}
        Logic Evaluation: ${JSON.stringify(fileRecord.logicEvaluation)}
        ${fileRecord.pdfUrl ? `PDF URL: ${fileRecord.pdfUrl}` : ''}
      `;

      structuredQuery = fileRecord.structuredQuery;
      matches = fileRecord.topMatches;
      logicEvaluations = fileRecord.logicEvaluation;

      // Update chat history with new user query
      fileRecord.chatHistory.push({ type: 'user', content: userQuery });
      await fileRecord.save();
    }

    else {
      return res.status(400).json({ error: 'No file, fileId, or pdfUrl provided' });
    }

    // 🧠 Call LLM for a JSON-formatted response
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'microsoft/mai-ds-r1:free',
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: `You are a professional assistant.
Answer the query based ONLY on the provided document content or structure.
Your response MUST be in JSON format, with a key 'answer' for the main response.
Example: {"answer": "The termination period is 30 days."}`, // ✅ MODIFIED: New prompt
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

    let reply = '⚠️ No response from model.';
    let parsedReply = {};
    try {
      // ✅ NEW: Attempt to parse the AI's response as JSON
      const rawContent = response.data.choices?.[0]?.message?.content || '{}';
      parsedReply = JSON.parse(rawContent);
      reply = parsedReply.answer || rawContent; // Extract 'answer' or use raw content as fallback
    } catch (e) {
      console.warn("AI did not respond in expected JSON format, using raw content.");
      reply = response.data.choices?.[0]?.message?.content || reply;
    }

    // 📝 Update chat history with the full JSON response for display
    if (fileRecord) {
      fileRecord.chatHistory.push({ type: 'bot', content: JSON.stringify(parsedReply, null, 2) });
      await fileRecord.save();
    }

    // Send the structured data and the AI's response to the frontend
    res.json({
      response: reply, // This will be the 'answer' field or raw string
      structuredQuery,
      topMatches: matches,
      logicEvaluations,
      fileId: fileRecord?._id,
      pdfUrl: fileRecord?.pdfUrl, // ✅ NEW: Return the PDF URL
      fullAiResponse: parsedReply // ✅ NEW: Optionally return the full parsed JSON from AI
    });

  } catch (err) {
    console.error("❌ handleFileQuery error:", err?.response?.data || err.message);
    res.status(500).json({ error: "Failed to process document query." });
  }
};

/**
 * Summarizes a static document using a different LLM.
 */
exports.summarizeDocument = async (req, res) => {
  const filePath = './uploads/sample.txt';

  try {
    const documentText = fs.readFileSync(filePath, 'utf-8');

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'microsoft/mai-ds-r1:free',
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

/**
 * Gets all uploaded files for a specific user.
 */
exports.getUserFiles = async (req, res) => {
  try {
    const files = await File.find({ userId: req.params.userId }).sort({ uploadedAt: -1 });
    res.json({ files });
  } catch (err) {
    console.error("❌ getUserFiles error:", err.message);
    res.status(500).json({ error: "Failed to fetch user files" });
  }
}; 