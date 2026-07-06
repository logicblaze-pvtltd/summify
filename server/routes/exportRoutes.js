import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getDocumentById } from "../database.js";

export function createExportRoutes() {
  const router = express.Router();

  router.get("/api/export/:id/:format", authenticateToken, async (req, res) => {
    try {
      const { id, format } = req.params;
      const doc = await getDocumentById(id, req.user.id);
      if (!doc) return res.status(404).send("Document not found");

      const content = `AI DOCUMENT SUMMARY REPORT
File Name: ${doc.fileName}
Date Processed: ${doc.uploadDate}

=========================================
1. SHORT SUMMARY
=========================================
${doc.summaries.short}

=========================================
2. DETAILED SUMMARY
=========================================
${doc.summaries.detailed}

=========================================
3. BULLET SUMMARY
=========================================
${doc.summaries.bullet}

=========================================
4. EXECUTIVE SUMMARY
=========================================
${doc.summaries.executive}
`;

      if (format === "txt") {
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName.replace(".pdf", "")}_summary.txt"`);
        return res.send(content);
      }

      if (format === "pdf") {
        res.setHeader("Content-Type", "text/html");
        res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName.replace(".pdf", "")}_summary.html"`);
        return res.send(`<html><head><title>Summary: ${doc.fileName}</title><style>body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #121929; } pre { background: #f5f6fb; padding: 20px; border-radius: 8px; white-space: pre-wrap; }</style></head><body><pre>${content}</pre></body></html>`);
      }

      if (format === "docx") {
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName.replace(".pdf", "")}_summary.docx"`);
        return res.send(Buffer.from(content, "utf-8"));
      }

      res.status(400).send("Invalid export format");
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).send("Internal server error");
    }
  });

  return router;
}
