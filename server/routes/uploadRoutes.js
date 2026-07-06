import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { upload, handleUploadRequest } from "../services/uploadService.js";

export function createUploadRoutes() {
  const router = express.Router();
  router.post("/api/upload", authenticateToken, upload.single("pdf"), handleUploadRequest);
  return router;
}
