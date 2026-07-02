import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
};

const DEFAULT_DOCUMENT_SUMMARIES = {
  short: "",
  detailed: "",
  bullet: "",
  executive: "",
};

let pool;

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

const normalizeDocumentRow = (row) => {
  if (!row) return null;

  const tags = parseJsonValue(row.tags, []);
  const chunks = parseJsonValue(row.chunks, []);
  const summaries = parseJsonValue(row.summaries, DEFAULT_DOCUMENT_SUMMARIES);
  const chatHistory = parseJsonValue(row.chat_history, []);

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
    text: row.text || "",
    chunks: Array.isArray(chunks) ? chunks : [],
    summaries: summaries && typeof summaries === "object" && !Array.isArray(summaries)
      ? summaries
      : { ...DEFAULT_DOCUMENT_SUMMARIES },
    chatHistory: Array.isArray(chatHistory) ? chatHistory : [],
    recentOverview: row.recent_overview || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
};

const serializeDocument = (document) => {
  if (!document?.id) {
    throw new Error("Document id is required.");
  }

  return {
    id: document.id,
    user_id: document.userId,
    file_name: document.fileName || "",
    file_size: document.fileSize || "",
    file_path: document.filePath || "",
    upload_date: document.uploadDate || "",
    status: document.status || "Uploading",
    tags: stringifyJsonValue(document.tags, []),
    page_count: Number.isFinite(Number(document.pageCount)) ? Number(document.pageCount) : 1,
    text: document.text || "",
    chunks: stringifyJsonValue(document.chunks, []),
    summaries: stringifyJsonValue(document.summaries, DEFAULT_DOCUMENT_SUMMARIES),
    chat_history: stringifyJsonValue(document.chatHistory, []),
    recent_overview: document.recentOverview || "",
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
  const [rows] = await pool.query("SELECT id, name, email, created_at FROM users WHERE id = ?", [id]);
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
    serialized.chunks,
    serialized.summaries,
    serialized.chat_history,
    serialized.recent_overview,
  ];

  await pool.query(
    `
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
        chunks,
        summaries,
        chat_history,
        recent_overview
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        chunks = VALUES(chunks),
        summaries = VALUES(summaries),
        chat_history = VALUES(chat_history),
        recent_overview = VALUES(recent_overview),
        updated_at = CURRENT_TIMESTAMP
    `,
    values
  );

  return document;
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