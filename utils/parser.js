const axios = require('axios');
require('dotenv').config();

/**
 * Extract structured clauses from plain text using OpenRouter LLM.
 * @param {string} text - The document text to analyze.
 * @returns {Promise<Object>} - JSON object of extracted clauses.
 */
exports.extractStructuredQuery = async (text) => {
  try {
    const prompt = `
You are a contract analysis AI. Extract key clauses like:
- Parties involved
- Duration
- Termination
- Confidentiality
- Governing Law
- Payment Terms
- Obligations
- Liability
- Any other important clause

Respond ONLY in clean JSON format without explanation.

Text:
"""${text}"""
`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const output = response.data.choices?.[0]?.message?.content || '{}';

    try {
      return JSON.parse(output);
    } catch (parseErr) {
      console.error("⚠️ JSON parse failed. Returning raw output.");
      return { raw: output };
    }

  } catch (err) {
    console.error("❌ extractStructuredQuery error:", err?.response?.data || err.message);
    return {};
  }
};
