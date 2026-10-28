import User from '../models/User.js';
import { verifyAccessToken } from '../utils/authTokens.js';

const INVALID_TOKEN_MESSAGE = 'Token invalid or expired!';

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
    decoded = verifyAccessToken(token);
  } catch {
    return res.status(401).json({
      message: INVALID_TOKEN_MESSAGE,
      code: 'AUTH_TOKEN_INVALID',
    });
  }

  if (decoded?.type !== 'access' || !decoded?.userId) {
    return res.status(401).json({
      message: INVALID_TOKEN_MESSAGE,
      code: 'AUTH_TOKEN_INVALID',
    });
  }

  let user;
  try {
    user = await User.findById(decoded.userId).select('_id lastActiveAt sessionVersion');
  } catch (error) {
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
