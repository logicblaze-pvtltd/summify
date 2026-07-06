import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getDocumentById, saveDocument } from "../database.js";
import {
  buildVocabulary,
  cosineSimilarity,
  generateEmbedding,
  getLocalRuleBasedAnswer,
  queryLLM,
} from "../services/documentProcessor.js";

export function createChatRoutes() {
  const router = express.Router();

  router.post("/api/chat/:id", authenticateToken, async (req, res) => {
    if (req.user.isGuest) {
      return res.status(403).json({
        error: "Authentication required",
        message: "AI Chat is only available for registered users. Please sign in to chat with your PDFs.",
      });
    }

    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required" });

    try {
      const doc = await getDocumentById(req.params.id, req.user.id);
      if (!doc) return res.status(404).json({ error: "Document not found" });

      const chunkTexts = doc.chunks.map((c) => c.text);
      const vocab = buildVocabulary(chunkTexts);
      const queryEmbed = await generateEmbedding(question, vocab);

      const scoredChunks = await Promise.all(doc.chunks.map(async (chunk) => {
        let chunkEmbed = chunk.embedding;
        if (!chunkEmbed || chunkEmbed.length !== queryEmbed.length) {
          chunkEmbed = await generateEmbedding(chunk.text, vocab);
        }
        return { text: chunk.text, score: cosineSimilarity(queryEmbed, chunkEmbed) };
      }));

      const broadQuestionPatterns = [
        /\bmain purpose\b/i, /\bpurpose of\b/i, /\bwhat is this\b/i, /\bwhat does this\b/i,
        /\bwhat is the document\b/i, /\babout\b/i, /\boverview\b/i, /\bsummary\b/i, /\btopic\b/i,
        /\bmain idea\b/i, /\bkey point\b/i, /\bmain subject\b/i, /\bintroduction\b/i,
        /\bconclusion\b/i, /\bwhat does it discuss\b/i,
      ];
      const isBroadQuestion = broadQuestionPatterns.some((pattern) => pattern.test(question));

      let contextText;
      if (isBroadQuestion && doc.text) {
        contextText = doc.text.substring(0, 14000);
      } else {
        scoredChunks.sort((a, b) => b.score - a.score);
        contextText = scoredChunks.slice(0, 5).map((c) => c.text).join("\n\n---\n\n");
      }

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

      let answer = "";
      try {
        answer = await queryLLM(systemPrompt, userPrompt);
      } catch {
        answer = getLocalRuleBasedAnswer(question, doc.text);
      }

      doc.chatHistory.push({ question, answer });
      await saveDocument(doc);
      res.json({ answer });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/api/chat/:id/clear", authenticateToken, async (req, res) => {
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
  });

  return router;
}
