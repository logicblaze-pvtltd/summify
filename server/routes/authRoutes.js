import express from "express";
import axios from "axios";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import { authenticateToken } from "../middleware/auth.js";
import { getUserByEmail, getUserById, createUser } from "../database.js";
import { hashPassword, verifyPassword } from "../services/authService.js";
import { migrateGuestDocumentsToUser } from "../services/fileStore.js";

export function createAuthRoutes() {
  const router = express.Router();

  router.post("/api/auth/google", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Google token is required" });

      const userInfoRes = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
      const { email, name } = userInfoRes.data;

      let user = await getUserByEmail(email);
      if (!user) {
        const randomPasswordHash = hashPassword(crypto.randomBytes(16).toString("hex"));
        const userId = await createUser(name, email, randomPasswordHash);
        user = { id: userId, email, name, role: "user", status: "Active" };
      }

      if (user.status === "Suspended") {
        return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
      }

      const guestDocumentsMigrated = await migrateGuestDocumentsToUser(req.headers["x-guest-id"], user.id);
      const jwtToken = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role || "user" }, JWT_SECRET, { expiresIn: "7d" });

      res.json({
        success: true,
        token: jwtToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role || "user" },
        guestDocumentsMigrated,
      });
    } catch (error) {
      console.error("Google Auth Error:", error);
      res.status(500).json({ error: "Google authentication failed on server" });
    }
  });

  router.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
      }

      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email is already registered" });
      }

      const passwordHash = hashPassword(password);
      const userId = await createUser(name, email, passwordHash);
      const guestDocumentsMigrated = await migrateGuestDocumentsToUser(req.headers["x-guest-id"], userId);
      const token = jwt.sign({ id: userId, email, name, role: "user" }, JWT_SECRET, { expiresIn: "7d" });

      res.status(201).json({
        success: true,
        token,
        user: { id: userId, name, email, role: "user" },
        guestDocumentsMigrated,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Internal server error during registration" });
    }
  });

  router.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await getUserByEmail(email);
      if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(400).json({ error: "Invalid email or password" });
      }

      if (user.status === "Suspended") {
        return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
      }

      const guestDocumentsMigrated = await migrateGuestDocumentsToUser(req.headers["x-guest-id"], user.id);
      const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role || "user" }, JWT_SECRET, { expiresIn: "7d" });

      res.json({
        success: true,
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role || "user" },
        guestDocumentsMigrated,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error during login" });
    }
  });

  router.get("/api/auth/profile", authenticateToken, async (req, res) => {
    try {
      const user = await getUserById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ user });
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
