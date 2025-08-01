// index.js

require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');

// Load Passport Google Strategy configuration
require('./config/passport');

const app = express();

// --- Middleware ---
// Configure CORS to allow requests from specific frontend origins
app.use(cors({
  origin: ['http://localhost:5173', 'https://docu-mind-wb79.vercel.app'], // Allowed frontend URLs
  credentials: true, // Enable sending cookies/authentication headers
}));

// Parse JSON request bodies
app.use(express.json());

// Initialize Passport for authentication (especially for Google OAuth)
app.use(passport.initialize());

// --- Routes ---
const authRoute = require('./routes/authRoute');
const queryRoute = require('./routes/queryRoute');

// Mount authentication routes under /api/auth
app.use('/api/auth', authRoute);

// Mount query (file upload, chat) routes under /api/query
app.use('/api/query', queryRoute);

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,      // Use the new URL parser
  useUnifiedTopology: true,   // Use the new server discovery and monitoring engine
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => console.error('❌ MongoDB connection failed:', err));

// --- Start Server ---
const PORT = process.env.PORT || 5000; // Use port from environment variable or default to 5000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});