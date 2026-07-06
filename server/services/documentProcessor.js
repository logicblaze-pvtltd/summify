import axios from "axios";
import fs from "fs";
import pdf from "pdf-parse";
import * as pdfToImg from "pdf-to-img";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import {
  DEFAULT_DOCUMENT_SUMMARIES,
  GEMINI_API_KEY,
  MAX_PDF_PAGES,
} from "../config.js";
import { getDocumentById, saveDocument } from "../database.js";

const STOPWORDS = new Set([
  "that","with","this","from","have","they","will","been","were","said","each","which","their","there","what","when","your","more","also","into","than","then","some","about","over","after","most",
]);

const QUESTION_INTENTS = {
  purpose: ["purpose","about","main","objective","goal","aim","describe","overview","summary","what is","what does"],
  conclusion: ["conclusion","recommend","result","finding","outcome","final"],
  dates: ["date","when","year","month","timeline","schedule","deadline"],
  stakeholders: ["who","stakeholder","author","team","person","people","contact","department"],
  chapter: ["chapter","section","part","summarize chapter","section 3"],
};

let successfulGeminiEmbeddingModel = null;
let successfulGeminiEmbeddingVersion = null;

export function chunkText(text, size = 1000, overlap = 200) {
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

export function getTFIDFEmbedding(text, vocabulary) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const freq = {};
  words.forEach((w) => (freq[w] = (freq[w] || 0) + 1));
  const embedding = Array(vocabulary.length).fill(0);
  vocabulary.forEach((word, idx) => {
    if (freq[word]) embedding[idx] = freq[word] / words.length;
  });
  return embedding;
}

export function buildVocabulary(chunks) {
  const allWords = new Set();
  chunks.forEach((chunk) => {
    const words = chunk.toLowerCase().match(/\b[a-z][a-z0-9]*\b/g) || [];
    words.forEach((w) => {
      if (w.length >= 2 && !STOPWORDS.has(w)) allWords.add(w);
    });
  });
  return Array.from(allWords).slice(0, 768);
}

export function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i += 1) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function generateEmbedding(text, docVocab = null) {
  if (GEMINI_API_KEY) {
    if (successfulGeminiEmbeddingModel) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/${successfulGeminiEmbeddingVersion}/${successfulGeminiEmbeddingModel}:embedContent?key=${GEMINI_API_KEY}`,
          { content: { parts: [{ text }] } },
          { headers: { "Content-Type": "application/json" } },
        );

        if (response.data?.embedding?.values) {
          return response.data.embedding.values;
        }
      } catch {
        successfulGeminiEmbeddingModel = null;
        successfulGeminiEmbeddingVersion = null;
      }
    }

    const candidates = [
      { model: "models/gemini-embedding-2", version: "v1beta" },
      { model: "models/text-embedding-004", version: "v1beta" },
      { model: "models/gemini-embedding-001", version: "v1beta" },
      { model: "models/embedding-001", version: "v1" },
    ];

    for (const candidate of candidates) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/${candidate.version}/${candidate.model}:embedContent?key=${GEMINI_API_KEY}`,
          { content: { parts: [{ text }] } },
          { headers: { "Content-Type": "application/json" } },
        );

        if (response.data?.embedding?.values) {
          successfulGeminiEmbeddingModel = candidate.model;
          successfulGeminiEmbeddingVersion = candidate.version;
          return response.data.embedding.values;
        }
      } catch (error) {
        console.error(`Gemini embedding attempt with ${candidate.model} failed:`, error.response?.data || error.message);
      }
    }
  }

  return getTFIDFEmbedding(text, docVocab && docVocab.length > 0 ? docVocab : ["document"]);
}

export async function queryLLM(systemPrompt, userPrompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured in Settings.");
  }

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
      ],
      generationConfig: { temperature: 0.2 },
    },
    { headers: { "Content-Type": "application/json" } },
  );
  return response.data.candidates[0].content.parts[0].text;
}

export function containsArabicScript(text) {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

export async function renderPageRTL(pageData) {
  const textContent = await pageData.getTextContent();
  const Y_TOLERANCE = 3;
  const items = textContent.items.filter((it) => it.str);
  items.sort((a, b) => b.transform[5] - a.transform[5]);

  const lines = [];
  for (const item of items) {
    const y = item.transform[5];
    let line = lines.find((l) => Math.abs(l.y - y) <= Y_TOLERANCE);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    } else {
      line.y = (line.y * line.items.length + y) / (line.items.length + 1);
    }
    line.items.push(item);
  }

  lines.sort((a, b) => b.y - a.y);
  return lines
    .map(({ items }) => {
      const lineText = items.map((it) => it.str).join("");
      items.sort((a, b) => (containsArabicScript(lineText) ? b.transform[4] - a.transform[4] : a.transform[4] - b.transform[4]));
      return items.map((it) => it.str).join("");
    })
    .join("\n");
}

export function generateLocalMockSummary(text, type) {
  const sentences = text
    .split(/[.!?]+\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && !s.includes("http") && !s.includes("www"));

  if (sentences.length === 0) {
    return "This document appears to contain minimal text content.";
  }

  if (type === "short") {
    return (
      `### Key Takeaways of the Document\n\n` +
      sentences.slice(0, Math.min(sentences.length, 4)).map((s) => `* **Highlight**: ${s}.`).join("\n") +
      `\n\n*Note: Running in offline local preview mode. Configure Gemini API in Settings for AI summaries.*`
    );
  }

  if (type === "bullet") {
    return (
      `### Important Action Items & Bullet points\n\n` +
      sentences.filter((_, i) => i % 2 === 0).slice(0, 6).map((s) => `• ${s}`).join("\n") +
      `\n\n*Configure settings to unlock active AI summarization.*`
    );
  }

  if (type === "detailed") {
    return (
      `### Detailed Document Overview\n\n` +
      `The document initiates by highlighting: "${sentences[0] || "the main introduction"}". It discusses key operational vectors, stressing that "${sentences[Math.floor(sentences.length / 3)] || "data and security integrity are crucial"}" and "${sentences[Math.floor((2 * sentences.length) / 3)] || "future metrics show progress"}". \n\n` +
      `In conclusion, the document stresses: "${sentences[sentences.length - 1] || "the final steps and timelines"}" which is core to the project roadmap.`
    );
  }

  return (
    `### Executive Report Summary\n\n` +
    `**1. Purpose & Scope**\n${sentences[0] || "Core context of the report"}.\n\n` +
    `**2. Primary Insights**\n- ${sentences[1] || "Operational milestones"}\n- ${sentences[Math.floor(sentences.length / 2)] || "Data metrics and updates"}\n\n` +
    `**3. Conclusion & Recommendations**\n${sentences[sentences.length - 1] || "Action items and roadmap directives"}.`
  );
}

export async function getPdfPageCount(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  try {
    const pdfData = await pdf(fileBuffer, { pagerender: () => "" });
    return pdfData.numpages || 1;
  } catch (error) {
    console.warn("PDF page count fallback using image conversion:", error.message);
    let pageCount = 0;
    const documentPages = await pdfToImg.pdf(filePath, { scale: 1 });
    for await (const _page of documentPages) {
      pageCount += 1;
      if (pageCount > MAX_PDF_PAGES) break;
    }
    return pageCount || 1;
  }
}

export function getLocalRuleBasedAnswer(question, text) {
  if (!text || text.trim().length === 0) {
    return "The document appears to have no readable text content.";
  }

  const qLower = question.toLowerCase();
  let intentType = null;
  for (const [type, patterns] of Object.entries(QUESTION_INTENTS)) {
    if (patterns.some((p) => qLower.includes(p))) {
      intentType = type;
      break;
    }
  }

  if (intentType === "purpose") {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 60);
    if (paragraphs.length > 0) {
      return `*Note: Running in offline preview mode — configure Gemini API in Settings for AI answers.*\n\n**Based on the document's opening content:**\n\n${paragraphs.slice(0, Math.min(3, paragraphs.length)).join("\n\n")}`;
    }
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  const FILLER = new Set(["what","which","where","when","does","this","that","with","from","have","the","and","for","are","was","were","its","how"]);
  const queryWords = qLower
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !FILLER.has(w));

  if (queryWords.length === 0) {
    const firstPara = text.replace(/\s+/g, " ").trim().substring(0, 600);
    return `*Note: Running in offline preview mode.*\n\n**Document opening:**\n\n${firstPara}...`;
  }

  const matches = [];
  sentences.forEach((sentence) => {
    const sentLower = sentence.toLowerCase();
    let score = 0;
    queryWords.forEach((word) => {
      if (sentLower.includes(word)) {
        const exactMatch = new RegExp(`\\b${word}\\b`).test(sentLower);
        score += exactMatch ? 2 : 1;
      }
    });
    if (score > 0) matches.push({ sentence, score });
  });

  matches.sort((a, b) => b.score - a.score);
  if (matches.length > 0) {
    return `*Note: Running in offline preview mode — configure Gemini API in Settings for AI answers.*\n\n**Relevant extracts from the document:**\n\n${matches.slice(0, 4).map((m) => `> ${m.sentence.trim()}`).join("\n\n")}`;
  }

  const preview = text.replace(/\s+/g, " ").trim().substring(0, 500);
  return `*Note: Offline mode — keyword match not found. Here is the document opening:*\n\n${preview}...`;
}

export async function processDocumentPipeline(docId) {
  try {
    const activeDoc = await getDocumentById(docId);
    if (!activeDoc) return;

    activeDoc.status = "Processing";
    await saveDocument(activeDoc);

    const fileBuffer = fs.readFileSync(activeDoc.filePath);
    let extractedText = "";
    let numPages = 1;

    try {
      const pdfData = await pdf(fileBuffer, { pagerender: renderPageRTL });
      extractedText = pdfData.text ? pdfData.text.trim() : "";
      numPages = pdfData.numpages || 1;
    } catch (pdfErr) {
      console.error("Standard parse failed:", pdfErr.message);
    }

    const cleanCheck = extractedText.replace(/CamScanner/gi, "").replace(/[\s\n\t]/g, "");
    const needsOcr = !extractedText || cleanCheck.length < 30;

    if (needsOcr) {
      activeDoc.status = "Performing Urdu OCR";
      await saveDocument(activeDoc);

      const ocrTextArray = [];
      let pageCounter = 0;
      const documentPages = await pdfToImg.pdf(activeDoc.filePath, { scale: 2.5 });
      for await (const pageBuffer of documentPages) {
        pageCounter += 1;
        const optimizedImageBuffer = await sharp(pageBuffer)
          .resize({ width: 2500 })
          .grayscale()
          .normalize()
          .toBuffer();

        const { data: { text } } = await Tesseract.recognize(optimizedImageBuffer, "eng+urd", {
          logger: (m) => console.log(`[Page ${pageCounter}] OCR Progress: ${Math.round(m.progress * 100)}%`),
          tessedit_pageseg_mode: "3",
        });

        if (text) {
          ocrTextArray.push(`--- PAGE ${pageCounter} ---\n${text.replace(/CamScanner/gi, "").trim()}`);
        }
      }

      extractedText = ocrTextArray.join("\n\n");
      numPages = pageCounter || 1;
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("Could not extract any content from the document.");
    }

    activeDoc.text = extractedText;
    activeDoc.pageCount = numPages;
    activeDoc.status = "Creating embeddings";
    await saveDocument(activeDoc);

    const textChunks = chunkText(extractedText, 1000, 200);
    activeDoc.chunks = textChunks.map((chunkTextValue, index) => ({
      id: index,
      text: chunkTextValue,
      embedding: [],
    }));

    const vocab = buildVocabulary(textChunks);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let i = 0; i < activeDoc.chunks.length; i += 1) {
      activeDoc.chunks[i].embedding = await generateEmbedding(activeDoc.chunks[i].text, vocab);
      await sleep(2500);
    }

    activeDoc.status = "Generating summary";
    await saveDocument(activeDoc);

    const summaries = { ...DEFAULT_DOCUMENT_SUMMARIES };
    const summaryInput = extractedText.substring(0, 12000);

    if (GEMINI_API_KEY) {
      try {
        const combinedResponse = await queryLLM(
          "You are an expert document summarization assistant. Respond professionally using the dominant language of the document context.",
          `Analyze the following document and provide four distinct types of summaries.\nYour response must contain all four sections clearly separated by these exact tags:\n[SHORT_SUMMARY], [DETAILED_SUMMARY], [BULLET_SUMMARY], and [EXECUTIVE_SUMMARY].\nMatch the dominant language of the document (if the text is in Urdu, write all summaries in Urdu).\n\nDocument text:\n${summaryInput}`,
        );

        const shortMatch = combinedResponse.match(/\[SHORT_SUMMARY\]([\s\S]*?)(?=\[DETAILED_SUMMARY\]|$)/i);
        const detailedMatch = combinedResponse.match(/\[DETAILED_SUMMARY\]([\s\S]*?)(?=\[BULLET_SUMMARY\]|$)/i);
        const bulletMatch = combinedResponse.match(/\[BULLET_SUMMARY\]([\s\S]*?)(?=\[EXECUTIVE_SUMMARY\]|$)/i);
        const execMatch = combinedResponse.match(/\[EXECUTIVE_SUMMARY\]([\s\S]*?)$/i);

        summaries.short = shortMatch ? shortMatch[1].trim() : combinedResponse.substring(0, 400);
        summaries.detailed = detailedMatch ? detailedMatch[1].trim() : combinedResponse;
        summaries.bullet = bulletMatch ? bulletMatch[1].trim() : "Review detailed section for main highlights.";
        summaries.executive = execMatch ? execMatch[1].trim() : "Review detailed section for executive summary.";
      } catch (error) {
        console.error(`AI Batch summary failed: ${error.message}. Falling back to local extractor.`);
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
    activeDoc.recentOverview = `${summaries.short.replace(/[#*`\n]/g, " ").substring(0, 150).trim()}...`;

    const tags = [];
    const lowerText = extractedText.toLowerCase();
    if (lowerText.includes("financial") || lowerText.includes("revenue")) tags.push("#Finance");
    if (lowerText.includes("poetry") || lowerText.includes("غزل") || lowerText.includes("مفہوم") || lowerText.includes("انیس")) tags.push("#Literature");
    if (lowerText.includes("legal") || lowerText.includes("agreement")) tags.push("#Legal");
    if (tags.length === 0) tags.push("#ScannedDoc");
    activeDoc.tags = tags;

    await saveDocument(activeDoc);
    console.log(`Document [${activeDoc.fileName}] fully processed via document pipeline!`);
  } catch (error) {
    console.error(`Error processing document ${docId}:`, error);
    const failedDoc = await getDocumentById(docId);
    if (failedDoc) {
      failedDoc.status = "Error";
      failedDoc.text = `An error occurred during extraction/OCR: ${error.message}`;
      await saveDocument(failedDoc);
    }
  }
}
