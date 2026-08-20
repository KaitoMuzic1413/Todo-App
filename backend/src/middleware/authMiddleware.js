import jwt from 'jsonwebtoken';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Không có token xác thực!' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'SECRET_KEY_CUA_BAN');
    req.user = decoded; // Lưu payload giải mã vào req.user
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token không hợp lệ hoặc hết hạn!' });
  }
};

export default verifyToken;