import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authentication token!' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'SECRET_KEY');
    const user = await User.findById(decoded.userId).select('_id lastActiveAt sessionVersion');

    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists.', code: 'ACCOUNT_NOT_FOUND' });
    }

    const reauthenticationCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (!user.lastActiveAt || user.lastActiveAt.getTime() < reauthenticationCutoff) {
      return res.status(401).json({ message: 'Please sign in again to continue.', code: 'REAUTH_REQUIRED' });
    }

    if (decoded.sessionVersion !== undefined && decoded.sessionVersion !== user.sessionVersion) {
      return res.status(401).json({ message: 'Session revoked. Please sign in again.', code: 'SESSION_REVOKED' });
    }

    const refreshedToken = jwt.sign(
      { userId: user._id, sessionVersion: user.sessionVersion },
      process.env.JWT_SECRET || 'SECRET_KEY',
      { expiresIn: '30d' }
    );
    res.set('X-Auth-Token', refreshedToken);
    req.user = decoded;
    await User.findByIdAndUpdate(user._id, {
      lastActiveAt: new Date(),
      inactiveDeletionNoticeSentAt: null,
    });
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired!' });
  }
};

export default verifyToken;