import jwt from "jsonwebtoken";

export const authenticateSocket = (socket, next) => {
  try {
    // Retrieve cookies from the socket handshake headers
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      return next(new Error("Authentication error: No cookies present"));
    }

    // Parse cookies
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map((c) => c.split("=").map(decodeURIComponent))
    );
    const token = cookies.accessToken;

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    // Verify and decode the JWT token
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    if (!decoded) {
      return next(new Error("Authentication error: Invalid token"));
    }

    // Attach user info to the socket object (limit fields if necessary)
    socket.user = { id: decoded.id, username: decoded.username };

    // Proceed to the next middleware
    next();
  } catch (err) {
    console.error("Socket authentication error:", err.message); // Log for debugging
    next(new Error("Authentication error: " + err.message));
  }
};
