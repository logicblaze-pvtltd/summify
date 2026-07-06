import express from "express";
import { settingsStore } from "../services/fileStore.js";

export function createSettingsRoutes() {
  const router = express.Router();

  router.get("/api/settings", (_req, res) => {
    res.json(settingsStore.get());
  });

  router.post("/api/settings", (req, res) => {
    const { geminiApiKey, ...safeBody } = req.body;
    const settings = settingsStore.update(safeBody);
    res.json({ success: true, settings });
  });

  return router;
}
