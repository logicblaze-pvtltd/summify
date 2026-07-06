import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const SERVER_DIR = path.dirname(__filename);

export const PORT = process.env.PORT || 5000;
export const JWT_SECRET = process.env.JWT_SECRET || "summify_secret_key_123456";
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export const ROOT_DIR = SERVER_DIR;
export const UPLOADS_DIR = path.join(SERVER_DIR, "uploads");
export const DATA_DIR = path.join(SERVER_DIR, "data");
export const LEGACY_DOCUMENTS_FILE = path.join(DATA_DIR, "documents.json");
export const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
export const GUEST_USAGE_FILE = path.join(DATA_DIR, "guest-usage.json");
export const CLIENT_DIST = path.join(SERVER_DIR, "..", "client", "dist");

export const GUEST_UPLOAD_LIMIT = 5;
export const MAX_PDF_PAGES = 50;

export const DEFAULT_DOCUMENT_SUMMARIES = {
  short: "",
  detailed: "",
  bullet: "",
  executive: "",
};

for (const dir of [UPLOADS_DIR, DATA_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
