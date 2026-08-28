import jwt from 'jsonwebtoken';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authentication token!' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'SECRET_KEY_CUA_BAN');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token invalid or expired!' });
  }
};

export default verifyToken;