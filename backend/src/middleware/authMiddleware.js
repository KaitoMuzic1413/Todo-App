import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = () => process.env.JWT_SECRET || 'SECRET_KEY';

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'No authentication token!',
      code: 'AUTH_TOKEN_MISSING',
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({
      message: 'No authentication token!',
      code: 'AUTH_TOKEN_MISSING',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET());
  } catch (error) {
    const expired = error?.name === 'TokenExpiredError';
    return res.status(401).json({
      message: expired ? 'Token expired. Please sign in again.' : 'Token invalid. Please sign in again.',
      code: expired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID',
    });
  }

  if (!decoded?.userId) {
    return res.status(401).json({
      message: 'Token is missing the user identity. Please sign in again.',
      code: 'AUTH_TOKEN_INVALID',
    });
  }

  let user;
  try {
    user = await User.findById(decoded.userId).select('_id lastActiveAt sessionVersion');
  } catch (error) {
    // Database/query failures are server errors, not invalid credentials.
    return next(error);
  }

  if (!user) {
    return res.status(401).json({
      message: 'Account no longer exists.',
      code: 'ACCOUNT_NOT_FOUND',
    });
  }

  const reauthenticationCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (!user.lastActiveAt || user.lastActiveAt.getTime() < reauthenticationCutoff) {
    return res.status(401).json({
      message: 'Please sign in again to continue.',
      code: 'REAUTH_REQUIRED',
    });
  }

  // Older MongoDB user documents may not have sessionVersion yet. Treat that
  // legacy state as version 0, matching the schema's default.
  const currentSessionVersion = user.sessionVersion ?? 0;
  if (
    decoded.sessionVersion !== undefined &&
    decoded.sessionVersion !== currentSessionVersion
  ) {
    return res.status(401).json({
      message: 'Session revoked. Please sign in again.',
      code: 'SESSION_REVOKED',
    });
  }

  const refreshedToken = jwt.sign(
    { userId: user._id, sessionVersion: currentSessionVersion },
    JWT_SECRET(),
    { expiresIn: '30d' }
  );
  res.set('X-Auth-Token', refreshedToken);
  req.user = {
    ...decoded,
    userId: user._id.toString(),
    sessionVersion: currentSessionVersion,
  };

  try {
    await User.findByIdAndUpdate(user._id, {
      lastActiveAt: new Date(),
      inactiveDeletionNoticeSentAt: null,
    });
  } catch (error) {
    return next(error);
  }

  return next();
};

export default verifyToken;