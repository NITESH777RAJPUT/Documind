const axios = require('axios');
require('dotenv').config();

// In-memory vector store (simulate FAISS-like search)
let vectorStore = [];

/**
 * Simulate text embedding using character-level encoding.
 * In production, replace with real embedding model like OpenAI Embeddings or Cohere.
 */
const embedText = async (text) => {
  try {
    // Here we mock embeddings using ASCII codes
    return text
      .split('')
      .map((char) => char.charCodeAt(0))
      .slice(0, 64); // limit vector length for speed
  } catch (err) {
    console.error("❌ Embedding failed:", err.message);
    return [];
  }
};

/**
 * Store a text with its fake vector in the memory store.
 * @param {string} text - Text to embed and store
 * @param {Object} metadata - Optional info to keep with the vector
 */
exports.storeEmbedding = async (text, metadata = {}) => {
  const vector = await embedText(text);
  vectorStore.push({ vector, metadata });
};

/**
 * Search top 3 similar vectors based on cosine similarity.
 * @param {string|Object} query - The user query to embed and compare
 * @returns {Promise<Array>} - Top 3 similar metadata chunks
 */
exports.searchSimilarChunks = async (query) => {
  const queryVector = await embedText(JSON.stringify(query));

  const cosineSimilarity = (vec1, vec2) => {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * (vec2[i] || 0), 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitude1 * magnitude2 || 1);
  };

  const results = vectorStore
    .map((entry) => ({
      similarity: cosineSimilarity(queryVector, entry.vector),
      metadata: entry.metadata,
    }))
    .sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, 3);
};
