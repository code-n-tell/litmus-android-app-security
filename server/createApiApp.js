import path from "node:path";
import cors from "cors";
import express from "express";
import {
  createPlatformFeature,
  createRisk,
  createFinding,
  deletePlatformFeature,
  deleteRisk,
  getDashboardData,
  initDb,
  listFindings,
  updateRiskText,
} from "./db.js";

export function createApiApp() {
  const app = express();
  const db = initDb();

  app.use(cors());
  app.use(express.json({ limit: "20mb" }));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "android-dashboard-api" });
  });

  app.get("/api/dashboard-data", (_req, res) => {
    try {
      res.json(getDashboardData(db));
    } catch (error) {
      res.status(500).json({ error: "Failed to load dashboard data", details: error.message });
    }
  });

  app.get("/api/findings", (_req, res) => {
    try {
      res.json({ findings: listFindings(db) });
    } catch (error) {
      res.status(500).json({ error: "Failed to load findings", details: error.message });
    }
  });

  app.post("/api/findings", (req, res) => {
    const payload = req.body || {};
    if (typeof payload.metadata !== "string" || !payload.metadata.trim()) {
      res.status(400).json({ error: "`metadata` is required" });
      return;
    }

    if (payload.riskStatus && typeof payload.riskStatus !== "object") {
      res.status(400).json({ error: "`riskStatus` must be an object" });
      return;
    }

    if (payload.observations && typeof payload.observations !== "object") {
      res.status(400).json({ error: "`observations` must be an object" });
      return;
    }

    try {
      const created = createFinding(db, payload);
      res.status(201).json({ finding: created });
    } catch (error) {
      res.status(500).json({ error: "Failed to save finding", details: error.message });
    }
  });

  app.post("/api/risks", (req, res) => {
    try {
      const created = createRisk(db, req.body || {});
      res.status(201).json({ risk: created });
    } catch (error) {
      const status = Number(error.status) || 500;
      res.status(status).json({ error: error.message || "Failed to create risk" });
    }
  });

  app.post("/api/platform-features", (req, res) => {
    try {
      const created = createPlatformFeature(db, req.body || {});
      res.status(201).json({ platformFeature: created });
    } catch (error) {
      const status = Number(error.status) || 500;
      res.status(status).json({ error: error.message || "Failed to create platform feature" });
    }
  });

  app.patch("/api/risks/:riskId/text", (req, res) => {
    try {
      const updated = updateRiskText(db, req.params.riskId, req.body || {});
      if (!updated) {
        res.status(400).json({
          error: "No valid text fields supplied. Allowed: name, description, goal",
        });
        return;
      }
      res.json({ risk: updated });
    } catch (error) {
      res.status(500).json({ error: "Failed to update risk text", details: error.message });
    }
  });

  app.delete("/api/platform-features/:featureId", (req, res) => {
    try {
      deletePlatformFeature(db, req.params.featureId);
      res.json({ ok: true });
    } catch (error) {
      const status = Number(error.status) || 500;
      res.status(status).json({ error: error.message || "Failed to delete platform feature" });
    }
  });

  app.delete("/api/risks/:riskId", (req, res) => {
    try {
      deleteRisk(db, req.params.riskId);
      res.json({ ok: true });
    } catch (error) {
      const status = Number(error.status) || 500;
      res.status(status).json({ error: error.message || "Failed to delete risk" });
    }
  });

  return app;
}
