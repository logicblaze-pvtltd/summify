import express from "express";
import fs from "fs";
import { authenticateToken } from "../middleware/auth.js";
import {
  deleteDocumentById,
  getDocumentById,
  getDocumentsByUserId,
} from "../database.js";
import { getGuestQuotaRecord } from "../services/fileStore.js";
import { GUEST_UPLOAD_LIMIT } from "../config.js";

export function createDocumentRoutes() {
  const router = express.Router();

  router.get("/api/documents", authenticateToken, async (req, res) => {
    try {
      const documents = await getDocumentsByUserId(req.user.id);
      const metadata = documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        uploadDate: doc.uploadDate,
        status: doc.status,
        tags: doc.tags || [],
        pageCount: doc.pageCount || 1,
        recentOverview: doc.recentOverview || "",
      }));
      res.json(metadata);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/api/documents/:id", authenticateToken, async (req, res) => {
    try {
      const doc = await getDocumentById(req.params.id, req.user.id);
      if (!doc) return res.status(404).json({ error: "Document not found" });
      res.json(doc);
    } catch (error) {
      console.error("Error fetching document detail:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/api/guest/quota", authenticateToken, async (req, res) => {
    try {
      if (!req.user.isGuest) {
        return res.json({
          guest: false,
          limit: null,
          used: null,
          remaining: null,
          resetAt: null,
        });
      }

      const quota = await getGuestQuotaRecord(req.user.id);
      const remaining = Math.max(GUEST_UPLOAD_LIMIT - quota.used, 0);

      res.json({
        guest: true,
        limit: GUEST_UPLOAD_LIMIT,
        used: quota.used,
        remaining,
        resetAt: quota.resetAt,
        periodStart: quota.periodStart,
        limitReached: quota.used >= GUEST_UPLOAD_LIMIT,
      });
    } catch (error) {
      console.error("Error fetching guest quota:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.delete("/api/documents/:id", authenticateToken, async (req, res) => {
    try {
      const doc = await getDocumentById(req.params.id, req.user.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (doc.filePath && fs.existsSync(doc.filePath)) {
        try {
          fs.unlinkSync(doc.filePath);
        } catch (error) {
          console.error("Failed to delete file from disk:", error.message);
        }
      }

      await deleteDocumentById(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
