const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const createToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// --- Register ---
exports.register = async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      if (!user.password) {
        return res.status(400).json({
          success: false,
          message: 'Email registered via Google. Please use Google login.',
        });
      }
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ email, password: hashedPassword });
    await user.save();

    const token = createToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: { id: user._id, email: user.email },
    });
  } catch (err) {
    console.error('Register Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// --- Login ---
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: 'User not found' });
    if (!user.password) return res.status(400).json({ success: false, message: 'Use Google login' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Wrong password' });

    const token = createToken(user);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email },
    });
  } catch (err) {
    console.error('Login Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// --- Google OAuth Login ---
exports.googleLogin = async (req, res) => {
  const { googleId, email } = req.body;
  try {
    let user = await User.findOne({ googleId });

    if (!user) {
      user = new User({ googleId, email });
      await user.save();
    }

    const token = createToken(user);

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      token,
      user: { id: user._id, email: user.email },
    });
  } catch (err) {
    console.error('Google Login Error:', err.message);
    res.status(500).json({ success: false, message: 'Google login failed' });
  }
};
