import fs from "node:fs";
import path from "node:path";
import {
  EMPTY_OBSERVATION_OPTIONS,
  canonicalizeObservationList,
  normalizeObservationOptions,
} from "./referenceData.js";

export const DB_PATH = path.resolve(process.cwd(), "data", "dashboard.db");
export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = new Set([".pdf", ".docx"]);

export function ensureDataDirectory() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureUploadsDirectory() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function sanitizeFilename(rawName) {
  const base = path.basename(String(rawName || "").trim());
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "evidence.bin";
}

export function persistDemoFile(payload) {
  const rawName = String(payload.demoFileName || "").trim();
  const rawBase64 = String(payload.demoFileContentBase64 || "").trim();
  if (!rawName || !rawBase64) {
    return { demoFileName: rawName || null, demoFilePath: null, absolutePath: null };
  }

  const ext = path.extname(rawName).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
    throw new Error("Only PDF or DOCX demo files are supported.");
  }

  const normalizedBase64 = rawBase64.includes(",")
    ? rawBase64.slice(rawBase64.indexOf(",") + 1)
    : rawBase64;
  const buffer = Buffer.from(normalizedBase64, "base64");
  if (!buffer.length) {
    throw new Error("Demo file content is empty.");
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("Demo file exceeds 10 MB limit.");
  }

  ensureUploadsDirectory();
  const safeName = sanitizeFilename(rawName);
  const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const absolutePath = path.join(UPLOADS_DIR, storedName);
  fs.writeFileSync(absolutePath, buffer);

  return {
    demoFileName: rawName,
    demoFilePath: `uploads/${storedName}`,
    absolutePath,
  };
}

export function parseJsonOrDefault(rawJson, fallback) {
  try {
    return JSON.parse(rawJson);
  } catch {
    return fallback;
  }
}

export function normalizePlatformFeatureId(rawValue) {
  const raw = String(rawValue || "").trim().toLowerCase();
  if (!raw) return null;

  let match = raw.match(/^pf[-_ ]?(\d{1,2})$/i);
  if (!match) {
    match = raw.match(/^platform[-_ ]feature[-_ ](\d{1,2})$/i);
  }
  if (!match) return null;

  const idx = String(Number(match[1])).padStart(2, "0");
  return `PF-${idx}`;
}

export function parseRiskIdentifier(rawValue, normalizedFeatureId) {
  const raw = String(rawValue || "").trim().toLowerCase();
  if (!raw) return null;

  let match = raw.match(/^pf[-_ ]?(\d{1,2})[-_ ]r(?:isk[-_ ]?)?(\d{1,2})$/i);
  if (match) {
    const featureIdx = String(Number(match[1])).padStart(2, "0");
    const riskIdx = String(Number(match[2])).padStart(2, "0");
    return { featureId: `PF-${featureIdx}`, riskId: `PF-${featureIdx}-R${riskIdx}` };
  }

  match = raw.match(/^platform[-_ ]feature[-_ ](\d{1,2})[-_ ]risk[-_ ](\d{1,2})$/i);
  if (match) {
    const featureIdx = String(Number(match[1])).padStart(2, "0");
    const riskIdx = String(Number(match[2])).padStart(2, "0");
    return { featureId: `PF-${featureIdx}`, riskId: `PF-${featureIdx}-R${riskIdx}` };
  }

  match = raw.match(/^r(?:isk[-_ ]?)?(\d{1,2})$/i) || raw.match(/^(\d{1,2})$/i);
  if (match && normalizedFeatureId) {
    const riskIdx = String(Number(match[1])).padStart(2, "0");
    return {
      featureId: normalizedFeatureId,
      riskId: `${normalizedFeatureId}-R${riskIdx}`,
    };
  }

  return null;
}

export function toPlatformFeatureSlug(featureId) {
  const match = String(featureId || "").match(/^PF-(\d{2})$/);
  return match ? `platform-feature-${match[1]}` : String(featureId || "").toLowerCase();
}

export function toRiskSlug(riskId) {
  const match = String(riskId || "").match(/^PF-(\d{2})-R(\d{2})$/);
  return match ? `platform-feature-${match[1]}-risk-${match[2]}` : String(riskId || "").toLowerCase();
}

export function normalizeStoredObservationOptions(rawValue) {
  return normalizeObservationOptions(rawValue, EMPTY_OBSERVATION_OPTIONS);
}

export function normalizeStoredObservations(rawValue, resultStatus = null) {
  if (Array.isArray(rawValue)) {
    return canonicalizeObservationList(rawValue);
  }

  if (rawValue && typeof rawValue === "object") {
    if (resultStatus === "at-risk") {
      return canonicalizeObservationList(rawValue.atRisk);
    }
    if (resultStatus === "reduced-risk") {
      return canonicalizeObservationList(rawValue.reducedRisk ?? rawValue.notAtRisk);
    }
    if (resultStatus === "pending") {
      return [];
    }

    return canonicalizeObservationList([
      ...(Array.isArray(rawValue.atRisk) ? rawValue.atRisk : []),
      ...(Array.isArray(rawValue.reducedRisk) ? rawValue.reducedRisk : []),
      ...(Array.isArray(rawValue.notAtRisk) ? rawValue.notAtRisk : []),
    ]);
  }

  return [];
}

export function buildStoredObservationsForStatus(_status, observations) {
  return canonicalizeObservationList(observations);
}

export function toStoredObservationsJson(statusOrObservations, maybeObservations) {
  const observations = maybeObservations === undefined ? statusOrObservations : maybeObservations;
  return JSON.stringify(buildStoredObservationsForStatus(null, observations));
}

export function normalizeFindingResultStatus(rawStatus, note = "") {
  const normalizedStatus = String(rawStatus || "").trim().toLowerCase();
  const normalizedNote = String(note || "").trim().toLowerCase();

  if (normalizedStatus === "pending" || normalizedNote === "pending assessment") {
    return "pending";
  }
  if (normalizedStatus === "at-risk" || normalizedStatus === "succeeded" || normalizedStatus === "exposed") {
    return "at-risk";
  }
  if (
    normalizedStatus === "reduced-risk"
    || normalizedStatus === "not-at-risk"
    || normalizedStatus === "blocked"
  ) {
    return "reduced-risk";
  }
  return null;
}

export function defaultFindingNote(resultStatus) {
  if (resultStatus === "pending") return "Pending assessment";
  if (resultStatus === "reduced-risk") return "Reduced risk";
  if (resultStatus === "at-risk") return "At risk";
  return "";
}

export function toDashboardStatusTuple(resultStatus, note, elaboration) {
  const tuple = [
    resultStatus === "at-risk" ? "succeeded" : "blocked",
    note || defaultFindingNote(resultStatus),
  ];
  if (elaboration) {
    tuple.push(elaboration);
  }
  return tuple;
}

export function buildObservationSummary(appName, observations) {
  const selected = canonicalizeObservationList(observations);
  if (selected.length === 0) {
    return null;
  }
  return `We observed that ${appName} ${selected.join("; ")}.`;
}

function normalizeTextForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractObservationSelectionsFromSummary(summary, options) {
  const normalizedSummary = normalizeTextForMatch(summary);
  if (!normalizedSummary) {
    return [];
  }

  const allOptions = canonicalizeObservationList([
    ...options.atRisk,
    ...options.reducedRisk,
  ]);

  return allOptions.filter((option) => {
    const normalizedOption = normalizeTextForMatch(option);
    if (!normalizedOption) return false;
    if (normalizedSummary.includes(normalizedOption)) return true;

    const tokens = normalizedOption.split(" ").filter((token) => token.length > 2);
    return tokens.length > 0 && tokens.every((token) => normalizedSummary.includes(token));
  });
}

export function coerceObservationInput(rawValue) {
  if (Array.isArray(rawValue)) {
    return canonicalizeObservationList(rawValue);
  }
  if (typeof rawValue === "string" && rawValue.trim()) {
    return canonicalizeObservationList(rawValue.split(/[;\n]+/));
  }
  return [];
}

export function getUserTableNames(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => row.name);
}

export function hasTable(db, tableName) {
  return getUserTableNames(db).includes(tableName);
}

export function hasColumn(db, tableName, columnName) {
  if (!hasTable(db, tableName)) return false;
  return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

export function ensureColumn(db, tableName, columnName, sqlDefinition) {
  if (!hasTable(db, tableName)) return;
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlDefinition}`);
}

export function quoteSqlString(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}
