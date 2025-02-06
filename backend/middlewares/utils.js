import jwt from 'jsonwebtoken';

export const verifyToken = (token) => {
  try {
    const user = jwt.verify(token, process.env.SECRET_KEY);
    return user; // Decoded token payload (e.g., user ID)
  } catch (err) {
    throw new Error('Invalid token');
  }
};
