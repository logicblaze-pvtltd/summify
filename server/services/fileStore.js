import fs from "fs";
import {
  DATA_DIR,
  DEFAULT_DOCUMENT_SUMMARIES,
  GUEST_USAGE_FILE,
  GUEST_UPLOAD_LIMIT,
  LEGACY_DOCUMENTS_FILE,
  SETTINGS_FILE,
} from "../config.js";
import {
  countDocumentsByUserId,
  getDocumentCount,
  reassignDocumentsByUserId,
  saveDocument,
} from "../database.js";

const readJsonFile = (filePath, defaultData = []) => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
  }
  return defaultData;
};

const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
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

export const settingsStore = {
  data: readJsonFile(SETTINGS_FILE, {
    autoPurgeDays: "Never",
    onDiskEncryption: true,
  }),
  get() {
    return this.data;
  },
  update(patch) {
    this.data = { ...this.data, ...patch };
    writeJsonFile(SETTINGS_FILE, this.data);
    return this.data;
  },
};

export const migrateGuestDocumentsToUser = async (guestId, userId) => {
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

export const getGuestQuotaRecord = async (guestId) => {
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

export const incrementGuestQuota = async (guestId, previousUsed = 0) => {
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

export const migrateLegacyDocumentsIfNeeded = async () => {
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
};
