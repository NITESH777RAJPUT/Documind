const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🔐 Protect routes with JWT verification
exports.requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('_id email');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    req.user = user; // ✅ Inject user object into request
    next();
  } catch (err) {
    console.error('❌ Auth Error:', err.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};
