import User from '../models/User.js';

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.userId).select('isAdmin');
    if (!user) return res.status(401).json({ message: 'Authentication required.' });
    if (!user.isAdmin) return res.status(403).json({ message: 'Administrator access required.' });
    return next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    return res.status(500).json({ message: 'Unable to verify administrator access.' });
  }
};

export default requireAdmin;
