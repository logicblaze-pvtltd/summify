import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import {
  CLIENT_DIST,
} from "./config.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createSettingsRoutes } from "./routes/settingsRoutes.js";
import { createDocumentRoutes } from "./routes/documentRoutes.js";
import { createUploadRoutes } from "./routes/uploadRoutes.js";
import { createChatRoutes } from "./routes/chatRoutes.js";
import { createExportRoutes } from "./routes/exportRoutes.js";
import { createAdminRoutes } from "./routes/adminRoutes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(createAuthRoutes());
  app.use(createSettingsRoutes());
  app.use(createDocumentRoutes());
  app.use(createUploadRoutes());
  app.use(createChatRoutes());
  app.use(createExportRoutes());
  app.use(createAdminRoutes());

  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(CLIENT_DIST, "index.html"));
    });
  }

  return app;
}
