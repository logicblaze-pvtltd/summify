import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import { settingsStore } from "../services/fileStore.js";
import {
  getUsersWithDocCount,
  getAllDocumentsWithOwner,
  getAuditLogs,
  createAuditLog,
  updateUserStatus,
  updateUserPlan,
  deleteUserById,
  deleteDocumentById,
  getDocumentById,
  saveDocument
} from "../database.js";

export function authenticateAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized. Token is missing." });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded || decoded.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }
    req.user = decoded;
    next();
  });
}

export function createAdminRoutes() {
  const router = express.Router();

  router.get("/api/admin/state", authenticateAdmin, async (req, res) => {
    try {
      const users = await getUsersWithDocCount();
      const documents = await getAllDocumentsWithOwner();
      const dbAudit = await getAuditLogs();
      const settings = settingsStore.get();

      // Ensure settings has defaults if empty
      const fullSettings = {
        portalName: settings.portalName || "Lumina AI",
        maintenanceMode: settings.maintenanceMode || false,
        guestUploadsEnabled: settings.guestUploadsEnabled !== undefined ? settings.guestUploadsEnabled : true,
        autoPurgeDays: settings.autoPurgeDays || 30,
        apiRateLimit: settings.apiRateLimit || 120,
        modelName: settings.modelName || "Gemini 2.5 Flash",
        encryption: settings.encryption || "AES-256",
        auditRetentionDays: settings.auditRetentionDays || 90,
      };

      // Calculate statistics
      const totalUsers = users.length;
      const documentsProcessed = documents.length;
      
      const proUsersCount = users.filter(u => u.plan === "Pro Monthly" && u.status === "Active").length;
      const entUsersCount = users.filter(u => u.plan === "Enterprise AI" && u.status === "Active").length;
      const freeUsersCount = users.filter(u => u.plan === "Free Starter" || u.plan === "Free").length;
      const activeUsers = proUsersCount + entUsersCount;
      const mrr = (proUsersCount * 49) + (entUsersCount * 499);

      const totalPlans = totalUsers || 1;
      const plansList = [
        { name: "Enterprise AI", value: Math.round((entUsersCount / totalPlans) * 100), color: "bg-primary" },
        { name: "Pro Monthly", value: Math.round((proUsersCount / totalPlans) * 100), color: "bg-blue-500" },
        { name: "Free Starter", value: Math.round((freeUsersCount / totalPlans) * 100), color: "bg-orange-400" },
      ];

      // Format invoices list
      const paidUsers = users.filter(u => u.plan !== "Free Starter" && u.plan !== "Free");
      const invoices = paidUsers.slice(0, 10).map((u, idx) => ({
        id: `inv-${1000 + idx}`,
        customer: u.name,
        amount: u.plan === "Enterprise AI" ? "$499" : "$49",
        status: u.status === "Active" ? "Paid" : "Due",
        date: new Date(u.created_at || Date.now()).toLocaleDateString()
      }));

      // Fallback invoice if empty
      if (invoices.length === 0) {
        invoices.push({ id: "inv-1000", customer: "No Paid Users Yet", amount: "$0", status: "Trial", date: "N/A" });
      }

      // Format Activity logs from audits
      const activity = dbAudit.slice(0, 10).map(log => ({
        id: log.id,
        user: log.actor,
        action: log.event,
        target: "System",
        time: new Date(log.time).toLocaleTimeString(),
        status: log.severity === "High" ? "Failed" : "Success"
      }));

      res.json({
        overview: {
          totalUsers,
          activeUsers,
          documentsProcessed,
          mrr,
          apiHealth: 99.98,
          avgLatency: 1.2,
          growth: 12.5,
          docGrowth: 24,
        },
        users: users.map(u => ({
          id: String(u.id),
          name: u.name,
          email: u.email,
          plan: u.plan,
          status: u.status,
          documents: u.documents,
          createdAt: u.created_at
        })),
        documents: documents.map(d => ({
          id: d.id,
          fileName: d.fileName,
          owner: d.owner,
          status: d.status,
          pages: d.pageCount,
          size: d.fileSize,
          uploadedAt: d.uploadDate,
          risk: "Low"
        })),
        subscriptions: {
          plans: plansList,
          invoices
        },
        settings: fullSettings,
        api: {
          clusterStatus: "Live Cluster",
          processingCore: "GPU (Metal/CUDA)",
          health: [
            { name: "Auth API", status: "Healthy", latency: "1.1ms" },
            { name: "Upload Pipeline", status: "Healthy", latency: "2.4s avg" },
            { name: "Chat Engine", status: "Healthy", latency: "180ms" },
            { name: "Export Service", status: "Healthy", latency: "0.8ms" },
          ],
          endpoints: [
            { path: "/api/auth/login", requests: 1842, errors: 2 },
            { path: "/api/upload", requests: 842, errors: 1 },
            { path: "/api/chat/:id", requests: 4421, errors: 3 },
            { path: "/api/documents", requests: 9021, errors: 0 },
          ],
        },
        activity,
        audit: dbAudit
      });
    } catch (error) {
      console.error("Failed to load admin state:", error);
      res.status(500).json({ error: "Internal server error fetching admin state" });
    }
  });

  router.post("/api/admin/users/:id/toggle-status", authenticateAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const users = await getUsersWithDocCount();
      const targetUser = users.find(u => String(u.id) === userId);

      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const newStatus = targetUser.status === "Suspended" ? "Active" : "Suspended";
      await updateUserStatus(userId, newStatus);
      await createAuditLog(
        `${req.user.name} (Admin)`,
        `${newStatus === "Suspended" ? "Suspended" : "Unsuspended"} user account ${targetUser.email}`,
        newStatus === "Suspended" ? "Warning" : "Info"
      );

      res.json({ success: true, status: newStatus });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to toggle user status" });
    }
  });

  router.post("/api/admin/users/:id/promote", authenticateAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { plan } = req.body;
      const users = await getUsersWithDocCount();
      const targetUser = users.find(u => String(u.id) === userId);

      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      await updateUserPlan(userId, plan);
      await createAuditLog(
        `${req.user.name} (Admin)`,
        `Updated subscription plan of user ${targetUser.email} to ${plan}`,
        "Info"
      );

      res.json({ success: true, plan });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to promote user" });
    }
  });

  router.delete("/api/admin/users/:id", authenticateAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const users = await getUsersWithDocCount();
      const targetUser = users.find(u => String(u.id) === userId);

      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      await deleteUserById(userId);
      await createAuditLog(
        `${req.user.name} (Admin)`,
        `Deleted user account ${targetUser.email}`,
        "High"
      );

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  router.post("/api/admin/documents/:id/status", authenticateAdmin, async (req, res) => {
    try {
      const docId = req.params.id;
      const { status } = req.body;
      const document = await getDocumentById(docId);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      document.status = status;
      await saveDocument(document);
      await createAuditLog(
        `${req.user.name} (Admin)`,
        `Marked document ${document.fileName} status as ${status}`,
        status === "Flagged" ? "Warning" : "Info"
      );

      res.json({ success: true, status });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update document status" });
    }
  });

  router.delete("/api/admin/documents/:id", authenticateAdmin, async (req, res) => {
    try {
      const docId = req.params.id;
      const document = await getDocumentById(docId);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      await deleteDocumentById(docId);
      await createAuditLog(
        `${req.user.name} (Admin)`,
        `Deleted document ${document.fileName}`,
        "Warning"
      );

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  router.post("/api/admin/settings", authenticateAdmin, async (req, res) => {
    try {
      const updated = settingsStore.update(req.body);
      const changes = Object.keys(req.body).map(k => `${k} to ${req.body[k]}`).join(", ");
      await createAuditLog(
        `${req.user.name} (Admin)`,
        `Updated settings: ${changes}`,
        "Info"
      );
      res.json({ success: true, settings: updated });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  router.post("/api/admin/audit", authenticateAdmin, async (req, res) => {
    try {
      const { event, severity } = req.body;
      await createAuditLog(`${req.user.name} (Admin)`, event, severity);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create audit log" });
    }
  });

  return router;
}
