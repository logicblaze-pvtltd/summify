import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  connectTimeout: 60000,
  enableKeepAlive: true,
};

const DEFAULT_DOCUMENT_SUMMARIES = {
  short: "",
  detailed: "",
  bullet: "",
  executive: "",
};

const MAX_TEXT_CHARS_FOR_DB = 160000;
const TEXT_STORAGE_DIRECTORY = path.join(process.cwd(), "uploads");

let pool;

const isTransientConnectionError = (error) => {
  const message = (error?.message || "").toLowerCase();
  return [
    "econnreset",
    "protocol_connection_lost",
    "protocol_enqueu_after_fatal_error",
    "connection lost",
    "connection closed",
    "terminated unexpectedly",
    "socket hang up",
    "etimedout",
  ].some((fragment) => message.includes(fragment));
};

const reconnectDatabase = async () => {
  if (pool) {
    try {
      await pool.end();
    } catch (cleanupError) {
      console.warn("Failed to close MySQL pool during reconnect:", cleanupError.message);
    }
  }

  pool = null;
  await initDatabase();
};

const parseJsonValue = (value, fallback) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const stringifyJsonValue = (value, fallback) => {
  const source = value === undefined ? fallback : value;
  if (source === null || source === undefined) {
    return null;
  }

  if (typeof source === "string") {
    return source;
  }

  return JSON.stringify(source);
};

const ensureTextStorageDirectory = () => {
  fs.mkdirSync(TEXT_STORAGE_DIRECTORY, { recursive: true });
  return TEXT_STORAGE_DIRECTORY;
};

const loadTextFromStorage = (textFilePath) => {
  if (!textFilePath) return null;

  try {
    if (fs.existsSync(textFilePath)) {
      return fs.readFileSync(textFilePath, "utf8");
    }
  } catch (error) {
    console.warn("Failed to load stored document text:", error.message);
  }

  return null;
};

const persistLargeTextIfNeeded = (document) => {
  if (!document || typeof document.text !== "string") {
    return document;
  }

  if (!document.text || document.text.length <= MAX_TEXT_CHARS_FOR_DB) {
    return document;
  }

  ensureTextStorageDirectory();
  const targetPath = path.join(TEXT_STORAGE_DIRECTORY, `${document.id || "document"}.txt`);

  if (!document.textFilePath || document.textFilePath !== targetPath) {
    try {
      fs.writeFileSync(targetPath, document.text, "utf8");
    } catch (error) {
      console.warn("Failed to persist large document text to disk:", error.message);
    }
  }

  return {
    ...document,
    text: document.text.slice(0, MAX_TEXT_CHARS_FOR_DB),
    textFilePath: targetPath,
  };
};

const normalizeDocumentRow = (row) => {
  if (!row) return null;

  const tags = parseJsonValue(row.tags, []);
  const chunks = parseJsonValue(row.chunks, []);
  const summaries = parseJsonValue(row.summaries, DEFAULT_DOCUMENT_SUMMARIES);
  const chatHistory = parseJsonValue(row.chat_history, []);
  const storedText = row.text || "";
  const textFilePath = row.text_file_path || "";
  const textFromStorage = loadTextFromStorage(textFilePath);
  const fullText = textFromStorage || storedText;

  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    filePath: row.file_path,
    uploadDate: row.upload_date,
    status: row.status,
    tags: Array.isArray(tags) ? tags : [],
    pageCount: Number.isFinite(Number(row.page_count)) ? Number(row.page_count) : 1,
    text: fullText || "",
    chunks: Array.isArray(chunks) ? chunks : [],
    summaries: summaries && typeof summaries === "object" && !Array.isArray(summaries)
      ? summaries
      : { ...DEFAULT_DOCUMENT_SUMMARIES },
    chatHistory: Array.isArray(chatHistory) ? chatHistory : [],
    recentOverview: row.recent_overview || "",
    textFilePath: textFilePath || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
};

const serializeDocument = (document) => {
  if (!document?.id) {
    throw new Error("Document id is required.");
  }

  const preparedDocument = persistLargeTextIfNeeded(document);

  return {
    id: preparedDocument.id,
    user_id: preparedDocument.userId,
    file_name: preparedDocument.fileName || "",
    file_size: preparedDocument.fileSize || "",
    file_path: preparedDocument.filePath || "",
    upload_date: preparedDocument.uploadDate || "",
    status: preparedDocument.status || "Uploading",
    tags: stringifyJsonValue(preparedDocument.tags, []),
    page_count: Number.isFinite(Number(preparedDocument.pageCount)) ? Number(preparedDocument.pageCount) : 1,
    text: preparedDocument.text || "",
    chunks: stringifyJsonValue(preparedDocument.chunks, []),
    summaries: stringifyJsonValue(preparedDocument.summaries, DEFAULT_DOCUMENT_SUMMARIES),
    chat_history: stringifyJsonValue(preparedDocument.chatHistory, []),
    recent_overview: preparedDocument.recentOverview || "",
    text_file_path: preparedDocument.textFilePath || null,
  };
};

export async function initDatabase() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const dbName = process.env.DB_NAME || "summify";
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    pool.on("error", (error) => {
      console.error("MySQL pool error:", error.message);
    });

    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    const createDocumentsTableQuery = `
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size VARCHAR(32) NOT NULL,
        file_path TEXT NOT NULL,
        upload_date VARCHAR(64) NOT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'Uploading',
        tags LONGTEXT NULL,
        page_count INT NOT NULL DEFAULT 1,
        text LONGTEXT NULL,
        text_file_path TEXT NULL,
        chunks LONGTEXT NULL,
        summaries LONGTEXT NULL,
        chat_history LONGTEXT NULL,
        recent_overview TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_documents_user_id (user_id),
        INDEX idx_documents_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.query(createUsersTableQuery);
    await pool.query(createDocumentsTableQuery);
    await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS text_file_path TEXT NULL`);

    // Safely add role, status, and plan columns to users table
    const [roleColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'role'");
    if (roleColumns.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user'");
    }

    const [statusColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'status'");
    if (statusColumns.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'Active'");
    }

    const [planColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'plan'");
    if (planColumns.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN plan VARCHAR(32) NOT NULL DEFAULT 'Free Starter'");
    }

    // Create audit_logs table
    const createAuditLogsTableQuery = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor VARCHAR(255) NOT NULL,
        event VARCHAR(255) NOT NULL,
        severity VARCHAR(32) NOT NULL DEFAULT 'Info',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.query(createAuditLogsTableQuery);

    // Seed default admin user
    const adminEmail = "admin@lumina-ai.com";
    const [adminRows] = await pool.query("SELECT * FROM users WHERE email = ?", [adminEmail]);
    if (adminRows.length === 0) {
      const { hashPassword } = await import("./services/authService.js");
      const passwordHash = hashPassword("admin123");
      await pool.query(
        "INSERT INTO users (name, email, password_hash, role, status, plan) VALUES (?, ?, ?, ?, ?, ?)",
        ["Admin User", adminEmail, passwordHash, "admin", "Active", "Enterprise AI"]
      );
      console.log("Seeded default admin user: admin@lumina-ai.com / admin123");
    }

    console.log("MySQL database initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize MySQL database:", error.message);
    throw error;
  }
}

export async function getUserByEmail(email) {
  if (!pool) throw new Error("Database not initialized.");
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] || null;
}

export async function getUserById(id) {
  if (!pool) throw new Error("Database not initialized.");
  const [rows] = await pool.query("SELECT id, name, email, role, status, plan, created_at FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function createUser(name, email, passwordHash) {
  if (!pool) throw new Error("Database not initialized.");
  const [result] = await pool.query(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    [name, email, passwordHash]
  );
  return result.insertId;
}

export async function getDocumentCount() {
  if (!pool) throw new Error("Database not initialized.");
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM documents");
  return Number(rows[0]?.total || 0);
}

export async function countDocumentsByUserId(userId) {
  if (!pool) throw new Error("Database not initialized.");
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM documents WHERE user_id = ?", [userId]);
  return Number(rows[0]?.total || 0);
}

export async function getDocumentsByUserId(userId) {
  if (!pool) throw new Error("Database not initialized.");
  const [rows] = await pool.query(
    "SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC, updated_at DESC",
    [userId]
  );
  return rows.map(normalizeDocumentRow);
}

export async function getDocumentById(id, userId = null) {
  if (!pool) throw new Error("Database not initialized.");

  let query = "SELECT * FROM documents WHERE id = ?";
  const params = [id];

  if (userId !== null && userId !== undefined) {
    query += " AND user_id = ?";
    params.push(userId);
  }

  query += " LIMIT 1";

  const [rows] = await pool.query(query, params);
  return normalizeDocumentRow(rows[0] || null);
}

export async function saveDocument(document) {
  if (!pool) throw new Error("Database not initialized.");

  const serialized = serializeDocument(document);
  const values = [
    serialized.id,
    serialized.user_id,
    serialized.file_name,
    serialized.file_size,
    serialized.file_path,
    serialized.upload_date,
    serialized.status,
    serialized.tags,
    serialized.page_count,
    serialized.text,
    serialized.text_file_path,
    serialized.chunks,
    serialized.summaries,
    serialized.chat_history,
    serialized.recent_overview,
  ];

  const querySql = `
    INSERT INTO documents (
      id,
      user_id,
      file_name,
      file_size,
      file_path,
      upload_date,
      status,
      tags,
      page_count,
      text,
      text_file_path,
      chunks,
      summaries,
      chat_history,
      recent_overview
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      file_name = VALUES(file_name),
      file_size = VALUES(file_size),
      file_path = VALUES(file_path),
      upload_date = VALUES(upload_date),
      status = VALUES(status),
      tags = VALUES(tags),
      page_count = VALUES(page_count),
      text = VALUES(text),
      text_file_path = VALUES(text_file_path),
      chunks = VALUES(chunks),
      summaries = VALUES(summaries),
      chat_history = VALUES(chat_history),
      recent_overview = VALUES(recent_overview),
      updated_at = CURRENT_TIMESTAMP
  `;

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await pool.query(querySql, values);
      return document;
    } catch (error) {
      lastError = error;
      if (!isTransientConnectionError(error) || attempt === 3) {
        throw error;
      }

      console.warn(`MySQL connection reset during saveDocument; retrying (${attempt}/3)...`);
      try {
        await reconnectDatabase();
      } catch (reconnectError) {
        console.error("Failed to reconnect to MySQL after transient error:", reconnectError.message);
      }
    }
  }

  throw lastError;
}

export async function deleteDocumentById(id, userId = null) {
  if (!pool) throw new Error("Database not initialized.");

  let query = "DELETE FROM documents WHERE id = ?";
  const params = [id];

  if (userId !== null && userId !== undefined) {
    query += " AND user_id = ?";
    params.push(userId);
  }

  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
}

export async function reassignDocumentsByUserId(fromUserId, toUserId) {
  if (!pool) throw new Error("Database not initialized.");
  const [result] = await pool.query(
    "UPDATE documents SET user_id = ? WHERE user_id = ?",
    [toUserId, fromUserId]
  );
  return result.affectedRows || 0;
}

export async function getUsersWithDocCount() {
  if (!pool) throw new Error("Database not initialized.");
  const [rows] = await pool.query(`
    SELECT u.id, u.name, u.email, u.role, u.status, u.plan, u.created_at,
           COUNT(d.id) AS documents
    FROM users u
    LEFT JOIN documents d ON CAST(u.id AS CHAR) = d.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);
  return rows;
}

export async function getAllDocumentsWithOwner() {
  if (!pool) throw new Error("Database not initialized.");
  const [rows] = await pool.query(`
    SELECT d.*, u.name AS owner_name, u.email AS owner_email
    FROM documents d
    LEFT JOIN users u ON d.user_id = CAST(u.id AS CHAR)
    ORDER BY d.created_at DESC
  `);
  return rows.map(row => ({
    ...normalizeDocumentRow(row),
    owner: row.owner_name || row.user_id,
    ownerEmail: row.owner_email || 'N/A'
  }));
}

export async function getAuditLogs() {
  if (!pool) throw new Error("Database not initialized.");
  const [rows] = await pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100");
  return rows.map(row => ({
    id: String(row.id),
    actor: row.actor,
    event: row.event,
    severity: row.severity,
    time: row.created_at
  }));
}

export async function createAuditLog(actor, event, severity = 'Info') {
  if (!pool) throw new Error("Database not initialized.");
  await pool.query(
    "INSERT INTO audit_logs (actor, event, severity) VALUES (?, ?, ?)",
    [actor, event, severity]
  );
}

export async function updateUserStatus(userId, status) {
  if (!pool) throw new Error("Database not initialized.");
  await pool.query("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
}

export async function updateUserPlan(userId, plan) {
  if (!pool) throw new Error("Database not initialized.");
  await pool.query("UPDATE users SET plan = ? WHERE id = ?", [plan, userId]);
}

export async function deleteUserById(userId) {
  if (!pool) throw new Error("Database not initialized.");
  await pool.query("DELETE FROM users WHERE id = ?", [userId]);
}