import express from "express";
import cors from "cors";
import multer from "multer";
import pdf from "pdf-parse";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";
import * as pdfToImg from "pdf-to-img";
import Tesseract from "tesseract.js";
import sharp from "sharp";
// Load environment variables
dotenv.config();

import jwt from "jsonwebtoken";
import { initDatabase, getUserByEmail, getUserById, createUser, countDocumentsByUserId, deleteDocumentById, getDocumentById, getDocumentCount, getDocumentsByUserId, reassignDocumentsByUserId, saveDocument } from "./database.js";

const JWT_SECRET = process.env.JWT_SECRET || "summify_secret_key_123456";

function authenticateToken(req, res, next) {
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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, originalHash] = storedHash.split(":");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === originalHash;
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Auth: Register
app.post("/api/auth/register", async (req, res) => {
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
    const guestDocumentsMigrated = migrateGuestDocumentsToUser(req.headers["x-guest-id"], userId);

    const token = jwt.sign({ id: userId, email, name }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({
      success: true,
      token,
      user: { id: userId, name, email },
      guestDocumentsMigrated
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error during registration" });
  }
});

// Auth: Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await getUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const guestDocumentsMigrated = migrateGuestDocumentsToUser(req.headers["x-guest-id"], user.id);
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email },
      guestDocumentsMigrated
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error during login" });
  }
});

// Auth: Get Profile
app.get("/api/auth/profile", authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Ensure directories exist
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const LEGACY_DOCUMENTS_FILE = path.join(DATA_DIR, "documents.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const GUEST_USAGE_FILE = path.join(DATA_DIR, "guest-usage.json");
const GUEST_UPLOAD_LIMIT = 5;
const DEFAULT_DOCUMENT_SUMMARIES = {
  short: "",
  detailed: "",
  bullet: "",
  executive: "",
};

// Helper to read/write persistent files
const readJsonFile = (filePath, defaultData = []) => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
  }
  return defaultData;
};

const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing file ${filePath}:`, err);
  }
};

const addMonths = (date, months = 1) => {
  const result = new Date(date);
  const dayOfMonth = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(dayOfMonth, lastDayOfMonth));
  return result;
};

const migrateGuestDocumentsToUser = async (guestId, userId) => {
  if (!guestId || !userId || guestId === "guest_default" || guestId === userId) {
    return 0;
  }

  try {
    return await reassignDocumentsByUserId(guestId, userId);
  } catch (error) {
    console.error("Guest document migration failed:", error);
    return 0;
  }
};

const createGuestQuotaRecord = (used = 0, startDate = new Date()) => ({
  used,
  periodStart: startDate.toISOString(),
  resetAt: addMonths(startDate, 1).toISOString(),
});

const getGuestQuotaRecord = async (guestId) => {
  const now = new Date();
  const guestUsage = readJsonFile(GUEST_USAGE_FILE, {});
  let record = guestUsage[guestId];

  if (!record) {
    const existingDocuments = await countDocumentsByUserId(guestId);
    record = createGuestQuotaRecord(existingDocuments, now);
    guestUsage[guestId] = record;
    writeJsonFile(GUEST_USAGE_FILE, guestUsage);
    return record;
  }

  const resetAt = record.resetAt ? new Date(record.resetAt) : null;
  if (resetAt && !Number.isNaN(resetAt.getTime()) && now >= resetAt) {
    record = createGuestQuotaRecord(0, now);
    guestUsage[guestId] = record;
    writeJsonFile(GUEST_USAGE_FILE, guestUsage);
    return record;
  }

  let needsSave = false;
  if (typeof record.used !== "number" || Number.isNaN(record.used)) {
    record.used = 0;
    needsSave = true;
  }
  if (!record.periodStart) {
    record.periodStart = now.toISOString();
    needsSave = true;
  }
  if (!record.resetAt) {
    record.resetAt = addMonths(new Date(record.periodStart), 1).toISOString();
    needsSave = true;
  }

  if (needsSave) {
    guestUsage[guestId] = record;
    writeJsonFile(GUEST_USAGE_FILE, guestUsage);
  }

  return record;
};

const incrementGuestQuota = async (guestId, previousUsed = 0) => {
  const now = new Date();
  const guestUsage = readJsonFile(GUEST_USAGE_FILE, {});
  let record = guestUsage[guestId];

  if (!record) {
    record = createGuestQuotaRecord(previousUsed, now);
  } else {
    const resetAt = record.resetAt ? new Date(record.resetAt) : null;
    if (resetAt && !Number.isNaN(resetAt.getTime()) && now >= resetAt) {
      record = createGuestQuotaRecord(0, now);
    } else {
      if (typeof record.used !== "number" || Number.isNaN(record.used)) {
        record.used = 0;
      }
      if (!record.periodStart) {
        record.periodStart = now.toISOString();
      }
      if (!record.resetAt) {
        record.resetAt = addMonths(new Date(record.periodStart), 1).toISOString();
      }
    }
  }

  record.used += 1;
  guestUsage[guestId] = record;
  writeJsonFile(GUEST_USAGE_FILE, guestUsage);
  return record;
};

const migrateLegacyDocumentsIfNeeded = async () => {
  try {
    const legacyDocuments = readJsonFile(LEGACY_DOCUMENTS_FILE, []);
    if (!Array.isArray(legacyDocuments) || legacyDocuments.length === 0) {
      return 0;
    }

    const existingCount = await getDocumentCount();
    if (existingCount > 0) {
      return 0;
    }

    let importedCount = 0;
    for (const legacyDocument of legacyDocuments) {
      await saveDocument({
        ...legacyDocument,
        tags: legacyDocument.tags || [],
        chunks: legacyDocument.chunks || [],
        summaries: legacyDocument.summaries || { ...DEFAULT_DOCUMENT_SUMMARIES },
        chatHistory: legacyDocument.chatHistory || [],
        recentOverview: legacyDocument.recentOverview || "",
      });
      importedCount += 1;
    }

    if (importedCount > 0) {
      console.log(`Migrated ${importedCount} legacy document(s) into MySQL.`);
    }

    return importedCount;
  } catch (error) {
    console.error("Legacy document migration failed:", error);
    return 0;
  }
};// Multer storage configuration for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"), false);
    }
  },
});

// Settings Management
let settings = readJsonFile(SETTINGS_FILE, {
  autoPurgeDays: "Never",
  onDiskEncryption: true,
});

// API key always from environment — never stored in settings.json
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Text Chunking Helper
function chunkText(text, size = 1000, overlap = 200) {
  const chunks = [];
  if (!text) return chunks;

  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    chunks.push(text.substring(i, end));
    i += size - overlap;
  }
  return chunks;
}

// Simple TF-IDF Vectorizer Fallback for Embeddings
function getTFIDFEmbedding(text, vocabulary) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const freq = {};
  words.forEach((w) => (freq[w] = (freq[w] || 0) + 1));

  const embedding = Array(vocabulary.length).fill(0);
  vocabulary.forEach((word, idx) => {
    if (freq[word]) {
      embedding[idx] = freq[word] / words.length;
    }
  });
  return embedding;
}

// Stopwords to skip when building vocabulary
const STOPWORDS = new Set([
  "that",
  "with",
  "this",
  "from",
  "have",
  "they",
  "will",
  "been",
  "were",
  "said",
  "each",
  "which",
  "their",
  "there",
  "what",
  "when",
  "your",
  "more",
  "also",
  "into",
  "than",
  "then",
  "some",
  "about",
  "over",
  "after",
  "most",
]);

// Helper to build a vocabulary from all chunks — includes short meaningful words
function buildVocabulary(chunks) {
  const allWords = new Set();
  chunks.forEach((chunk) => {
    const words = chunk.toLowerCase().match(/\b[a-z][a-z0-9]*\b/g) || [];
    words.forEach((w) => {
      // Keep words that are at least 2 chars and not pure stopwords
      if (w.length >= 2 && !STOPWORDS.has(w)) allWords.add(w);
    });
  });
  return Array.from(allWords).slice(0, 768); // Larger vocabulary = better accuracy
}

// Cosine Similarity
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Cache for the working Gemini embedding model to optimize multi-chunk processing
let successfulGeminiEmbeddingModel = null;
let successfulGeminiEmbeddingVersion = null;

// API Calls to Google Gemini
async function generateEmbedding(text, docVocab = null) {
  const apiKey = GEMINI_API_KEY;

  if (apiKey) {
    // If we have already found a working model, try that first
    if (successfulGeminiEmbeddingModel) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/${successfulGeminiEmbeddingVersion}/${successfulGeminiEmbeddingModel}:embedContent?key=${apiKey}`,
          {
            content: { 
              parts: [{ text: text }] 
            }
          },
          { 
            headers: { 'Content-Type': 'application/json' } 
          }
        );

        if (response.data?.embedding?.values) {
          return response.data.embedding.values;
        }
      } catch (err) {
        console.warn(`Cached model ${successfulGeminiEmbeddingModel} failed, resetting...`);
        successfulGeminiEmbeddingModel = null;
        successfulGeminiEmbeddingVersion = null;
      }
    }

    // Try candidate models in order of preference
    const candidates = [
      { model: "models/gemini-embedding-2", version: "v1beta" },
      { model: "models/text-embedding-004", version: "v1beta" },
      { model: "models/gemini-embedding-001", version: "v1beta" },
      { model: "models/embedding-001", version: "v1" }
    ];

    for (const candidate of candidates) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/${candidate.version}/${candidate.model}:embedContent?key=${apiKey}`,
          {
            content: { 
              parts: [{ text: text }] 
            }
          },
          { 
            headers: { 'Content-Type': 'application/json' } 
          }
        );

        if (response.data?.embedding?.values) {
          // Cache the successful model and version
          successfulGeminiEmbeddingModel = candidate.model;
          successfulGeminiEmbeddingVersion = candidate.version;
          console.log(`Successfully embedded text using ${candidate.model} (${candidate.version})`);
          return response.data.embedding.values;
        }
      } catch (err) {
        console.error(`Gemini embedding attempt with ${candidate.model} failed:`, err.response?.data || err.message);
      }
    }
    console.error("All Gemini embedding model attempts failed.");
  }

  // --- TF-IDF FALLBACK ---
  if (docVocab && docVocab.length > 0) {
    return getTFIDFEmbedding(text, docVocab);
  }
  return getTFIDFEmbedding(text, ['document']);
}
async function queryLLM(systemPrompt, userPrompt) {
  const apiKey = GEMINI_API_KEY;

  if (apiKey) {
    try {
      // API Studio Standard Endpoint for Gemini 2.5 Flash
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        },
        {
          headers: { "Content-Type": "application/json" },
        },
      );
      return response.data.candidates[0].content.parts[0].text;
    } catch (err) {
      console.error(
        "Gemini LLM Call failed:",
        err.response?.data || err.message,
      );
      throw err;
    }
  } else {
    throw new Error("Gemini API key is not configured in Settings.");
  }
}
// Detects Arabic-script characters (covers Arabic, Urdu, Persian, etc.)
function containsArabicScript(text) {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

// pdf-parse's DEFAULT text builder just concatenates pdf.js text items in the
// order they appear in the PDF content stream, inserting a newline whenever
// the y-position changes. For this Urdu/Nastaliq PDF, each *glyph* is its own
// positioned text item, so the default builder emits ~one character per line
// with no correct left/right ordering at all — reversing lines does nothing
// because most "lines" are a single character.
//
// The correct fix works at the geometry level: pdf.js gives us each item's
// exact (x, y) position via item.transform. We:
//   1. Cluster items into lines by y-coordinate, using a TOLERANCE rather
//      than exact rounding — Nastaliq glyphs (dots, diacritics, connecting
//      strokes) often sit a fraction of a point above/below the main
//      baseline, so exact-match rounding was splitting single lines into
//      several 1-2 character fragments.
//   2. Sort lines top-to-bottom (PDF y-axis increases upward, so descending).
//   3. Within each line, sort items RIGHT-TO-LEFT by x (descending) — correct
//      reading order for Urdu/Arabic — instead of pdf-parse's implicit
//      left-to-right assumption.
//   4. Concatenate each line's glyphs in that corrected order.
//
// This is passed to pdf-parse via its `pagerender` option, so it replaces
// pdf-parse's default (broken-for-RTL) page renderer entirely.
async function renderPageRTL(pageData) {
  const textContent = await pageData.getTextContent();
  const Y_TOLERANCE = 3; // points; merges same-line glyphs with slight baseline drift

  const items = textContent.items.filter((it) => it.str);

  // Sort top -> bottom first so we can cluster sequentially.
  items.sort((a, b) => b.transform[5] - a.transform[5]);

  const lines = [];
  for (const item of items) {
    const y = item.transform[5];
    let line = lines.find((l) => Math.abs(l.y - y) <= Y_TOLERANCE);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    } else {
      // Keep the line's reference y as a running average so a long run of
      // slightly-drifting glyphs doesn't slowly wander onto the next line.
      line.y = (line.y * line.items.length + y) / (line.items.length + 1);
    }
    line.items.push(item);
  }

  // Re-sort lines top-to-bottom (cluster discovery order isn't guaranteed).
  lines.sort((a, b) => b.y - a.y);

  const outputLines = lines.map(({ items }) => {
    const lineText = items.map((it) => it.str).join("");

    if (containsArabicScript(lineText)) {
      // RTL line: rightmost glyph (largest x) comes first in reading order.
      items.sort((a, b) => b.transform[4] - a.transform[4]);
    } else {
      // LTR line: leftmost glyph first, as normal.
      items.sort((a, b) => a.transform[4] - b.transform[4]);
    }

    return items.map((it) => it.str).join("");
  });

  return outputLines.join("\n");
}

// Fallback high-quality mock summarizer/chat engine in case no API key or Ollama is running
function generateLocalMockSummary(text, type) {
  // Extract key sentences
  const sentences = text
    .split(/[.!?]+\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && !s.includes("http") && !s.includes("www"));

  if (sentences.length === 0) {
    return "This document appears to contain minimal text content.";
  }

  const title = sentences[0]
    ? sentences[0].substring(0, 100)
    : "Document Summary";

  if (type === "short") {
    return (
      `### Key Takeaways of the Document\n\n` +
      sentences
        .slice(0, Math.min(sentences.length, 4))
        .map((s) => `* **Highlight**: ${s}.`)
        .join("\n") +
      `\n\n*Note: Running in offline local preview mode. Configure Gemini API in Settings for AI summaries.*`
    );
  } else if (type === "bullet") {
    return (
      `### Important Action Items & Bullet points\n\n` +
      sentences
        .filter((_, i) => i % 2 === 0)
        .slice(0, 6)
        .map((s) => `• ${s}`)
        .join("\n") +
      `\n\n*Configure settings to unlock active AI summarization.*`
    );
  } else if (type === "detailed") {
    return (
      `### Detailed Document Overview\n\n` +
      `The document initiates by highlighting: "${sentences[0] || "the main introduction"}". It discusses key operational vectors, stressing that "${sentences[Math.floor(sentences.length / 3)] || "data and security integrity are crucial"}" and "${sentences[Math.floor((2 * sentences.length) / 3)] || "future metrics show progress"}". \n\n` +
      `In conclusion, the document stresses: "${sentences[sentences.length - 1] || "the final steps and timelines"}" which is core to the project roadmap.`
    );
  } else {
    return (
      `### Executive Report Summary\n\n` +
      `**1. Purpose & Scope**\n${sentences[0] || "Core context of the report"}.\n\n` +
      `**2. Primary Insights**\n- ${sentences[1] || "Operational milestones"}\n- ${sentences[Math.floor(sentences.length / 2)] || "Data metrics and updates"}\n\n` +
      `**3. Conclusion & Recommendations**\n${sentences[sentences.length - 1] || "Action items and roadmap directives"}.`
    );
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Get settings
app.get("/api/settings", (req, res) => {
  res.json(settings);
});

// Update settings
app.post("/api/settings", (req, res) => {
  // Never persist the API key — it lives only in .env
  const { geminiApiKey, ...safeBody } = req.body;
  settings = { ...settings, ...safeBody };
  writeJsonFile(SETTINGS_FILE, settings);
  res.json({ success: true, settings });
});

// List documents (Library)
app.get("/api/documents", authenticateToken, async (req, res) => {
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

// Get single document detail (including summaries)
app.get("/api/documents/:id", authenticateToken, async (req, res) => {
  try {
    const doc = await getDocumentById(req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  } catch (error) {
    console.error("Error fetching document detail:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Guest quota status
app.get("/api/guest/quota", authenticateToken, async (req, res) => {
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

// Delete document
app.delete("/api/documents/:id", authenticateToken, async (req, res) => {
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

// Upload and Process PDF (Optimized for Scanned Urdu and Rate-Limits)
app.post("/api/upload", authenticateToken, upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Check guest upload limit
    let quota = null;
    if (req.user.isGuest) {
      quota = await getGuestQuotaRecord(req.user.id);
      if (quota.used >= GUEST_UPLOAD_LIMIT) {
        if (req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (error) {}
        }
        return res.status(403).json({
          error: "Upload limit reached",
          message: `Guest users can only upload up to ${GUEST_UPLOAD_LIMIT} PDFs per month. Please sign in to upload more!`,
        });
      }
    }

    const docId = crypto.randomUUID();
    const filePath = req.file.path;

    // Encoding fix for Urdu/Arabic filenames (Prevents corruption like Ã˜ÂºÃ˜Â²Ã™...)
    const fileName = Buffer.from(req.file.originalname, "latin1").toString(
      "utf8",
    );

    const fileSize = (req.file.size / (1024 * 1024)).toFixed(1) + " MB";
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
      pageCount: 1,
      text: "",
      chunks: [],
      summaries: { ...DEFAULT_DOCUMENT_SUMMARIES },
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

    // Asynchronous processing (Hybrid Pipeline optimized for Urdu Scanned Documents)
    (async () => {
      try {
        const activeDoc = await getDocumentById(docId);
        if (!activeDoc) return;

        activeDoc.status = "Processing";
        await saveDocument(activeDoc);

        const fileBuffer = fs.readFileSync(filePath);
        let extractedText = "";
        let numPages = 1;

        // 1. Try standard text extraction
        try {
          const pdfData = await pdf(fileBuffer, { pagerender: renderPageRTL });
          extractedText = pdfData.text ? pdfData.text.trim() : "";
          numPages = pdfData.numpages || 1;
        } catch (pdfErr) {
          console.error("Standard parse failed:", pdfErr.message);
        }

        // 2. CRITICAL CLEANUP: Check if extracted text is just CamScanner noise
        const cleanCheck = extractedText
          .replace(/CamScanner/gi, "")
          .replace(/[\s\n\t]/g, "");

        // NOTE: We tried unconditionally routing Arabic-script text through
        // Tesseract OCR here (to sidestep Nastaliq's diagonal glyph stacking),
        // but in practice Tesseract's Urdu recognition on this document was
        // WORSE than the geometry-based renderPageRTL extraction above â€” it
        // produced English-letter gibberish instead of readable Urdu. Since
        // renderPageRTL already reconstructs the text-layer at high accuracy,
        // only fall back to OCR when there's genuinely no usable text layer
        // (scanned/CamScanner PDFs), not just because the text is Arabic.
        const needsOcr = !extractedText || cleanCheck.length < 30;

        if (needsOcr) {
          console.log(
            `Scanned/CamScanner PDF detected for ${fileName}. Triggering OCR...`,
          );

          activeDoc.status = "Performing Urdu OCR";
          await saveDocument(activeDoc);

          let ocrTextArray = [];
          let pageCounter = 0;

          try {
            const documentPages = await pdfToImg.pdf(filePath, { scale: 2.5 }); // High scale for crisp Urdu text

            for await (const pageBuffer of documentPages) {
              pageCounter++;
              console.log(`Processing page ${pageCounter} with Urdu OCR...`);

              // Sharp Image Optimization for Urdu Nastaliq script (grayscale & normalize to preserve thin cursive connections)
              const optimizedImageBuffer = await sharp(pageBuffer)
                .resize({ width: 2500 }) // Upscale
                .grayscale()
                .normalize()
                .toBuffer();
              // Tesseract Engine with English + Urdu models combined
              const {
                data: { text },
              } = await Tesseract.recognize(optimizedImageBuffer, "eng+urd", {
                logger: (m) =>
                  console.log(
                    `[Page ${pageCounter}] OCR Progress: ${Math.round(m.progress * 100)}%`,
                  ),
                // Use default automatic page segmentation (PSM 3) to support multi-column layouts like Ghazals/poems
                tessedit_pageseg_mode: "3",
              });

              if (text) {
                const cleanedPageText = text.replace(/CamScanner/gi, "").trim();
                ocrTextArray.push(
                  `--- PAGE ${pageCounter} ---\n${cleanedPageText}`,
                );
              }
            }

            extractedText = ocrTextArray.join("\n\n");
            numPages = pageCounter || 1;
          } catch (ocrError) {
            console.error("OCR Pipeline failed:", ocrError);
            throw new Error(
              `Failed during Urdu OCR processing: ${ocrError.message}`,
            );
          }
        }

        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error("Could not extract any content from the document.");
        }

        // 3. Update Text Metadata
        activeDoc.text = extractedText;
        activeDoc.pageCount = numPages;
        activeDoc.status = "Creating embeddings";
        await saveDocument(activeDoc);

        // 4. Chunking & Local Vocabulary
        const textChunks = chunkText(extractedText, 1000, 200);
        activeDoc.chunks = textChunks.map((chunkText, index) => ({
          id: index,
          text: chunkText,
          embedding: [],
        }));

        const vocab = buildVocabulary(textChunks);
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        for (let i = 0; i < activeDoc.chunks.length; i++) {
          activeDoc.chunks[i].embedding = await generateEmbedding(
            activeDoc.chunks[i].text,
            vocab,
          );
          await sleep(2500);
        }

        activeDoc.status = "Generating summary";
        await saveDocument(activeDoc);

        // 5. SINGLE-CALL SUMMARIZATION (Fixed 429 Rate Limit Issue)
        const summaries = { short: "", detailed: "", bullet: "", executive: "" };
        const apiReady = !!GEMINI_API_KEY;
        const summaryInput = extractedText.substring(0, 12000);

        if (apiReady) {
          try {
            // Combined master prompt to get all summaries in 1 single API call
            const masterPrompt = `Analyze the following document and provide four distinct types of summaries. 
Your response must contain all four sections clearly separated by these exact tags: 
[SHORT_SUMMARY], [DETAILED_SUMMARY], [BULLET_SUMMARY], and [EXECUTIVE_SUMMARY].
Match the dominant language of the document (if the text is in Urdu, write all summaries in Urdu).

Document text:
${summaryInput}`;

            const combinedResponse = await queryLLM(
              "You are an expert document summarization assistant. Respond professionally using the dominant language of the document context.",
              masterPrompt,
            );

            // Regex matching to parse sections safely
            const shortMatch = combinedResponse.match(
              /\[SHORT_SUMMARY\]([\s\S]*?)(?=\[DETAILED_SUMMARY\]|$)/i,
            );
            const detailedMatch = combinedResponse.match(
              /\[DETAILED_SUMMARY\]([\s\S]*?)(?=\[BULLET_SUMMARY\]|$)/i,
            );
            const bulletMatch = combinedResponse.match(
              /\[BULLET_SUMMARY\]([\s\S]*?)(?=\[EXECUTIVE_SUMMARY\]|$)/i,
            );
            const execMatch = combinedResponse.match(
              /\[EXECUTIVE_SUMMARY\]([\s\S]*?)$/i,
            );

            summaries.short = shortMatch
              ? shortMatch[1].trim()
              : combinedResponse.substring(0, 400);
            summaries.detailed = detailedMatch
              ? detailedMatch[1].trim()
              : combinedResponse;
            summaries.bullet = bulletMatch
              ? bulletMatch[1].trim()
              : "Review detailed section for main highlights.";
            summaries.executive = execMatch
              ? execMatch[1].trim()
              : "Review detailed section for executive summary.";
          } catch (e) {
            console.error(
              `AI Batch summary failed: ${e.message}. Falling back to local extractor.`,
            );
            for (const key of Object.keys(summaries)) {
              summaries[key] = generateLocalMockSummary(extractedText, key);
            }
          }
        } else {
          for (const key of Object.keys(summaries)) {
            summaries[key] = generateLocalMockSummary(extractedText, key);
          }
        }

        activeDoc.summaries = summaries;
        activeDoc.status = "Ready for Chat";
        activeDoc.recentOverview =
          summaries.short
            .replace(/[#*`\n]/g, " ")
            .substring(0, 150)
            .trim() + "...";

        // 6. Dynamic Tag Management
        const tags = [];
        const lowerText = extractedText.toLowerCase();
        if (lowerText.includes("financial") || lowerText.includes("revenue"))
          tags.push("#Finance");
        if (
          lowerText.includes("poetry") ||
          lowerText.includes("Ø´Ø§Ø¹Ø±ÛŒ") ||
          lowerText.includes("Ù…Ø±Ø«ÛŒÛ") ||
          lowerText.includes("Ø§Ù†ÛŒØ³")
        )
          tags.push("#Literature");
        if (lowerText.includes("legal") || lowerText.includes("agreement"))
          tags.push("#Legal");
        if (tags.length === 0) tags.push("#ScannedDoc");
        activeDoc.tags = tags;

        await saveDocument(activeDoc);
        console.log(
          `Document [${fileName}] fully processed via Urdu-OCR pipeline!`,
        );
      } catch (err) {
        console.error(`Error processing document ${docId}:`, err);
        const failedDoc = await getDocumentById(docId);
        if (failedDoc) {
          failedDoc.status = "Error";
          failedDoc.text = `An error occurred during extraction/OCR: ${err.message}`;
          await saveDocument(failedDoc);
        }
      }
    })();
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
});

// Chat Endpoint
app.post("/api/chat/:id", authenticateToken, async (req, res) => {
  if (req.user.isGuest) {
    return res.status(403).json({
      error: "Authentication required",
      message: "AI Chat is only available for registered users. Please sign in to chat with your PDFs."
    });
  }

  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Question is required" });

  try {
    const doc = await getDocumentById(req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    // 1. Build vocab from stored chunk texts and embed user query in same space
    const chunkTexts = doc.chunks.map((c) => c.text);
    const vocab = buildVocabulary(chunkTexts);
    const queryEmbed = await generateEmbedding(question, vocab);

    // 2. Compute similarity for RAG
    // If chunk embeddings were stored with a different vocab size, recompute them on the fly
    const scoredChunks = doc.chunks.map((chunk) => {
      let chunkEmbed = chunk.embedding;
      // If stored embedding dimension doesn't match current vocab, recompute
      if (!chunkEmbed || chunkEmbed.length !== queryEmbed.length) {
        chunkEmbed = getTFIDFEmbedding(chunk.text, vocab);
      }
      const sim = cosineSimilarity(queryEmbed, chunkEmbed);
      return { text: chunk.text, score: sim };
    });

    // 3. Detect broad/general questions that need the full document context
    const broadQuestionPatterns = [
      /\bmain purpose\b/i, /\bpurpose of\b/i,
      /\bwhat is this\b/i, /\bwhat does this\b/i, /\bwhat is the document\b/i,
      /\babout\b/i, /\boverview\b/i, /\bsummary\b/i, /\btopic\b/i,
      /\bmain idea\b/i, /\bkey point\b/i, /\bmain subject\b/i,
      /\bintroduction\b/i, /\bconclusion\b/i, /\bwhat does it discuss\b/i,
    ];
    const isBroadQuestion = broadQuestionPatterns.some(p => p.test(question));

    let contextText;
    if (isBroadQuestion && doc.text) {
      // For broad questions, send as much of the full document as possible
      contextText = doc.text.substring(0, 14000);
    } else {
      // For specific questions, use RAG top-5 chunks
      scoredChunks.sort((a, b) => b.score - a.score);
      const topChunks = scoredChunks.slice(0, 5);
      contextText = topChunks.map((c) => c.text).join("\n\n---\n\n");
    }

    // 4. Send to LLM with balanced instructions
    const systemPrompt = `You are a helpful AI assistant specializing in document analysis.
Answer the user's question based on the provided document context.
- For broad questions (purpose, topic, overview, summary), give a comprehensive answer synthesizing the full context.
- For specific questions, find the precise answer from the context.
- Always respond in the same language as the document (e.g., if the document is in Urdu, reply in Urdu).
- Only say "Information not found in the uploaded document." if the information is genuinely absent after thoroughly reviewing the context.`;

    const userPrompt = `DOCUMENT CONTEXT:
${contextText}

QUESTION:
${question}

Provide a clear, helpful answer based on the document context above.`;

    const hasKeys = !!GEMINI_API_KEY;
    let answer = "";

    if (hasKeys) {
      try {
        answer = await queryLLM(systemPrompt, userPrompt);
      } catch (err) {
        // Fallback rule-based answering
        answer = getLocalRuleBasedAnswer(question, doc.text);
      }
    } else {
      answer = getLocalRuleBasedAnswer(question, doc.text);
    }

    // Append to chat history
    doc.chatHistory.push({ question, answer });
    await saveDocument(doc);

    res.json({ answer });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset Chat Endpoint
app.post("/api/chat/:id/clear", authenticateToken, async (req, res) => {
  try {
    const doc = await getDocumentById(req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    doc.chatHistory = [];
    await saveDocument(doc);
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing chat:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});// Common question-type patterns for intent detection
const QUESTION_INTENTS = {
  purpose: [
    "purpose",
    "about",
    "main",
    "objective",
    "goal",
    "aim",
    "describe",
    "overview",
    "summary",
    "what is",
    "what does",
  ],
  conclusion: [
    "conclusion",
    "recommend",
    "result",
    "finding",
    "outcome",
    "final",
  ],
  dates: ["date", "when", "year", "month", "timeline", "schedule", "deadline"],
  stakeholders: [
    "who",
    "stakeholder",
    "author",
    "team",
    "person",
    "people",
    "contact",
    "department",
  ],
  chapter: ["chapter", "section", "part", "summarize chapter", "section 3"],
};

// Enhanced keyword search RAG fallback for local/offline run
function getLocalRuleBasedAnswer(question, text) {
  if (!text || text.trim().length === 0) {
    return "The document appears to have no readable text content.";
  }

  const qLower = question.toLowerCase();

  // Detect question intent
  let intentType = null;
  for (const [type, patterns] of Object.entries(QUESTION_INTENTS)) {
    if (patterns.some((p) => qLower.includes(p))) {
      intentType = type;
      break;
    }
  }

  // For "purpose" / "about" / "what is" questions → return first meaningful paragraphs
  if (intentType === "purpose") {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 60);

    if (paragraphs.length > 0) {
      const intro = paragraphs
        .slice(0, Math.min(3, paragraphs.length))
        .join("\n\n");
      return `*Note: Running in offline preview mode — configure Gemini API in Settings for AI answers.*\n\n**Based on the document's opening content:**\n\n${intro}`;
    }
  }

  // Split into individual sentences for matching
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  // Build scored word list — strip filler words, keep meaningful terms
  const FILLER = new Set([
    "what",
    "which",
    "where",
    "when",
    "does",
    "this",
    "that",
    "with",
    "from",
    "have",
    "the",
    "and",
    "for",
    "are",
    "was",
    "were",
    "its",
    "how",
  ]);
  const queryWords = qLower
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !FILLER.has(w));

  if (queryWords.length === 0) {
    // No useful keywords — return first paragraph
    const firstPara = text.replace(/\s+/g, " ").trim().substring(0, 600);
    return `*Note: Running in offline preview mode.*\n\n**Document opening:**\n\n${firstPara}...`;
  }

  // Score each sentence by keyword hits (weighted by word rarity)
  const matches = [];
  sentences.forEach((sentence) => {
    const sentLower = sentence.toLowerCase();
    let score = 0;
    queryWords.forEach((word) => {
      if (sentLower.includes(word)) {
        // Bonus: exact word boundaries score higher
        const exactMatch = new RegExp(`\\b${word}\\b`).test(sentLower);
        score += exactMatch ? 2 : 1;
      }
    });
    if (score > 0) {
      matches.push({ sentence, score });
    }
  });

  matches.sort((a, b) => b.score - a.score);

  if (matches.length > 0) {
    const topAnswers = matches
      .slice(0, 4)
      .map((m) => `> ${m.sentence.trim()}`)
      .join("\n\n");
    return `*Note: Running in offline preview mode — configure Gemini API in Settings for AI answers.*\n\n**Relevant extracts from the document:**\n\n${topAnswers}`;
  }

  // Last resort: return first 500 characters of the document
  const preview = text.replace(/\s+/g, " ").trim().substring(0, 500);
  return `*Note: Offline mode — keyword match not found. Here is the document opening:*\n\n${preview}...`;
}

// Export Summary as Text/HTML file
app.get("/api/export/:id/:format", authenticateToken, async (req, res) => {
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
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${doc.fileName.replace(".pdf", "")}_summary.txt"`,
      );
      return res.send(content);
    } else if (format === "pdf") {
      // Return HTML styled representation which can be printed as PDF by the browser
      res.setHeader("Content-Type", "text/html");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${doc.fileName.replace(".pdf", "")}_summary.html"`,
      );
      return res.send(
        `<html><head><title>Summary: ${doc.fileName}</title><style>body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #121929; } pre { background: #f5f6fb; padding: 20px; border-radius: 8px; white-space: pre-wrap; }</style></head><body><pre>${content}</pre></body></html>`,
      );
    } else if (format === "docx") {
      // Lightweight docx download representation
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${doc.fileName.replace(".pdf", "")}_summary.docx"`,
      );
      // Sending text content as fallback document payload
      return res.send(Buffer.from(content, "utf-8"));
    }

    res.status(400).send("Invalid export format");
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).send("Internal server error");
  }
});
// Serve static client build files
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback: serve index.html for any non-API route
  app.get("*", (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

// Start Server
initDatabase()
  .then(async () => {
    await migrateLegacyDocumentsIfNeeded();
    app.listen(PORT, () => {
      console.log(`Server is running securely on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database initialization failed. Exiting...", err);
    process.exit(1);
  });