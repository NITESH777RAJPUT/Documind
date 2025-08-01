const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');

// Normal auth
router.post('/register', authController.register);
router.post('/login', authController.login);

// ✅ Google OAuth Routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // ✅ Redirect with token (or send token via response if preferred)
    res.redirect(`https://docu-mind-wb79.vercel.app/chat?token=${token}`);
  }
);

module.exports = router;
