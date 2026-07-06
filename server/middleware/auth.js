import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    const guestId = req.headers["x-guest-id"] || "guest_default";
    req.user = { id: guestId, isGuest: true };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      const guestId = req.headers["x-guest-id"] || "guest_default";
      req.user = { id: guestId, isGuest: true };
      return next();
    }
    req.user = { ...user, isGuest: false };
    next();
  });
}
