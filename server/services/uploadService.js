import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import {
  GUEST_UPLOAD_LIMIT,
  MAX_PDF_PAGES,
  UPLOADS_DIR,
} from "../config.js";
import { saveDocument } from "../database.js";
import {
  getGuestQuotaRecord,
  incrementGuestQuota,
} from "./fileStore.js";
import {
  getPdfPageCount,
  processDocumentPipeline,
} from "./documentProcessor.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"), false);
    }
  },
});

export async function handleUploadRequest(req, res) {
  try {
    if (!req.file) {
      console.log("Upload attempt without a file.");
      return res.status(400).json({ error: "No file uploaded" });
    }

    let quota = null;
    if (req.user.isGuest) {
      quota = await getGuestQuotaRecord(req.user.id);
      if (quota.used >= GUEST_UPLOAD_LIMIT) {
        if (req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch {}
        }
        return res.status(403).json({
          error: "Upload limit reached",
          message: `Guest users can only upload up to ${GUEST_UPLOAD_LIMIT} PDFs per month. Please sign in to upload more!`,
        });
      }
    }

    const docId = crypto.randomUUID();
    const filePath = req.file.path;
    const pageCount = await getPdfPageCount(filePath);

    if (pageCount > MAX_PDF_PAGES) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({
        error: "Page limit exceeded",
        message: `PDF may not exceed ${MAX_PDF_PAGES} pages. Please upload a shorter document.`,
      });
    }

    const fileName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const fileSize = `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`;
    const uploadDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const newDoc = {
      id: docId,
      userId: req.user.id,
      fileName,
      fileSize,
      filePath,
      uploadDate,
      status: "Uploading",
      tags: ["#New"],
      pageCount,
      text: "",
      chunks: [],
      summaries: {},
      chatHistory: [],
      recentOverview: "",
    };

    await saveDocument(newDoc);

    if (req.user.isGuest) {
      try {
        await incrementGuestQuota(req.user.id, quota ? quota.used : 0);
      } catch (error) {
        console.error("Failed to update guest quota:", error);
      }
    }

    res.json({ id: docId, status: "Processing" });
    void processDocumentPipeline(docId);
  } catch (error) {
    console.error("Upload error:", error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Failed to clean up uploaded file:", cleanupError.message);
      }
    }
    res.status(500).json({ error: "Internal server error during upload" });
  }
}
