require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');

// ✅ Load Passport Google Strategy before using routes
require('./config/passport');

const app = express();

// --- Middleware ---
// ✅ Allow only your frontend domain for CORS
app.use(cors({
  origin: 'https://docu-mind-sigma.vercel.app',
  credentials: true, // ✅ For sending cookies or tokens
}));

app.use(express.json());
app.use(passport.initialize()); // 🔐 For Google OAuth

// --- Routes ---
const authRoute = require('./routes/authRoute');
const queryRoute = require('./routes/queryRoute');

app.use('/api/auth', authRoute);     // 🔐 Auth (login/register/google)
app.use('/api/query', queryRoute);   // 📄 File Upload + Query + Summary

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => console.error('❌ MongoDB connection failed:', err));

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
