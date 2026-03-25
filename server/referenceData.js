import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { loadDefaultsFromApp } from "./extractDefaults.js";

const WORKBOOK_PATH = path.resolve(process.cwd(), "..", "Android mobile app security findings.xlsx");

const APP_NAME_ALIASES = new Map([
  ["SP: Utilities & EV Charging", "PowerHome"],
]);

const FEATURE_CONTEXT_OVERRIDES = {
  "PF-02":
    "USB debugging is a feature that allows communication between an Android device and a computer via Android Debug Bridge (ADB). It enables developers to install apps, run commands, access logs, and debug applications.",
};

const RISK_OBSERVATION_OPTION_OVERRIDES = {
  "PF-01-R02": {
    atRisk: [
      "Can be repackaged",
      "Runs after repackaging",
    ],
    reducedRisk: [
      "Can be repackaged",
      "Runs after repackaging",
      "Cannot be repackaged - obfuscation",
      "Runs after repackaging with non-cancellable dialog",
      "Crashes upon launch after repackaging",
    ],
  },
};

export const EMPTY_CONTACT = Object.freeze({
  name: "",
  number: "",
  email: "",
});

export const EMPTY_CONTACTS = Object.freeze([]);
export const EMPTY_OBSERVATION_OPTIONS = Object.freeze({
  atRisk: [],
  reducedRisk: [],
});

function dedupeStrings(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )];
}

function canonicalizeAppName(rawValue) {
  const trimmed = String(rawValue || "").trim();
  return APP_NAME_ALIASES.get(trimmed) || trimmed;
}

function parseRiskId(rawValue) {
  const raw = String(rawValue || "").trim().toLowerCase();
  const match = raw.match(/^platform[-_ ]feature[-_ ](\d{1,2})[-_ ]risk[-_ ](\d{1,2})/i);
  if (!match) return null;
  return `PF-${String(Number(match[1])).padStart(2, "0")}-R${String(Number(match[2])).padStart(2, "0")}`;
}

function isMarked(value) {
  return String(value || "").trim() !== "";
}

function stripGuideFormatting(value) {
  return String(value || "")
    .replace(/\{([^}]+)\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseGuideText(rawValue) {
  const lines = String(rawValue || "")
    .split(/\r?\n/)
    .map((line) => stripGuideFormatting(line))
    .filter(Boolean);

  return {
    description: lines[0] || "",
    goal: lines[1] || "",
  };
}

function titleCaseWords(value) {
  return String(value || "")
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeObservationOptions(rawValue, fallback = EMPTY_OBSERVATION_OPTIONS) {
  const source =
    rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
      ? rawValue
      : fallback;

  const atRisk = dedupeStrings(source.atRisk);
  const reducedRisk = dedupeStrings([
    ...(Array.isArray(source.reducedRisk) ? source.reducedRisk : []),
    ...(Array.isArray(source.notAtRisk) ? source.notAtRisk : []),
    ...atRisk,
  ]);

  return {
    atRisk: atRisk.filter((value) => reducedRisk.includes(value)),
    reducedRisk,
  };
}

function loadWorkbookData() {
  const observationOptionsByRisk = {};
  const observationsByRiskAndApp = {};

  if (!fs.existsSync(WORKBOOK_PATH)) {
    return { observationOptionsByRisk, observationsByRiskAndApp };
  }

  const workbook = XLSX.readFile(WORKBOOK_PATH);
  const overallSheet = workbook.Sheets["Overall risk"];
  if (!overallSheet) {
    return { observationOptionsByRisk, observationsByRiskAndApp };
  }

  const overallRows = XLSX.utils.sheet_to_json(overallSheet, { header: 1, defval: "" });
  const overallApps = (overallRows[0] || []).slice(1).map(canonicalizeAppName);
  const atRiskAppsByRisk = new Map();

  overallRows.slice(1).forEach((row) => {
    const riskId = parseRiskId(row[0]);
    if (!riskId) return;

    const appSet = new Set();
    overallApps.forEach((appName, index) => {
      if (isMarked(row[index + 1])) {
        appSet.add(appName);
      }
    });
    atRiskAppsByRisk.set(riskId, appSet);
  });

  workbook.SheetNames.forEach((sheetName) => {
    if (sheetName === "Overall risk") return;

    const riskId = parseRiskId(sheetName);
    if (!riskId) return;

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    const apps = (rows[0] || []).slice(1).map(canonicalizeAppName);
    const observationsByApp = {};

    rows.slice(1).forEach((row) => {
      const observation = String(row[0] || "").trim();
      if (!observation) return;

      apps.forEach((appName, index) => {
        if (!isMarked(row[index + 1])) return;
        if (!observationsByApp[appName]) {
          observationsByApp[appName] = [];
        }
        observationsByApp[appName].push(observation);
      });
    });

    observationsByRiskAndApp[riskId] = Object.fromEntries(
      Object.entries(observationsByApp).map(([appName, values]) => [appName, dedupeStrings(values)])
    );

    const atRiskOptions = new Set();
    const reducedRiskOptions = new Set();
    const atRiskApps = atRiskAppsByRisk.get(riskId) || new Set();

    Object.entries(observationsByRiskAndApp[riskId]).forEach(([appName, values]) => {
      values.forEach((value) => reducedRiskOptions.add(value));
      if (atRiskApps.has(appName)) {
        values.forEach((value) => atRiskOptions.add(value));
      }
    });

    observationOptionsByRisk[riskId] = normalizeObservationOptions({
      atRisk: [...atRiskOptions],
      reducedRisk: [...reducedRiskOptions],
    });
  });

  return { observationOptionsByRisk, observationsByRiskAndApp };
}

function buildReferenceData() {
  const defaults = loadDefaultsFromApp();
  const workbookData = loadWorkbookData();
  const sectorNameById = new Map(
    (defaults.sectors || []).map((sector) => [String(sector.id || "").trim(), String(sector.name || "").trim()])
  );

  const platformFeatures = (defaults.platformFeatures || []).map((feature, index) => ({
    id: feature.id,
    name: feature.name || feature.description,
    additionalContext: feature.additionalContext || FEATURE_CONTEXT_OVERRIDES[feature.id] || "",
    sortOrder: index,
  }));

  const risks = (defaults.risks || []).map((risk, index) => {
    const guide = parseGuideText(defaults.riskConsequences?.[risk.id]);
    return {
      id: risk.id,
      featureId: risk.pf,
      name: risk.name,
      severity: risk.severity || "High",
      description: guide.description || risk.elaboration || "",
      goal: guide.goal || risk.goal || "",
      observationOptions: normalizeObservationOptions(
        RISK_OBSERVATION_OPTION_OVERRIDES[risk.id] || workbookData.observationOptionsByRisk[risk.id],
        EMPTY_OBSERVATION_OPTIONS
      ),
      sortOrder: index,
    };
  });

  return {
    defaults,
    platformFeatures,
    risks,
    riskById: new Map(risks.map((risk) => [risk.id, risk])),
    sectorNameById,
    workbookObservationsByRiskAndApp: workbookData.observationsByRiskAndApp,
  };
}

export const REFERENCE_DATA = buildReferenceData();

export function getRiskReference(riskId) {
  return REFERENCE_DATA.riskById.get(String(riskId || "").trim()) || null;
}

export function getRiskSeverity(riskId) {
  return getRiskReference(riskId)?.severity || "High";
}

export function getSectorPresentation(sectorValue, fallbackSortOrder = Number.MAX_SAFE_INTEGER) {
  const id = String(sectorValue || "").trim() || "unassigned";
  return {
    id,
    name: REFERENCE_DATA.sectorNameById.get(id) || titleCaseWords(id),
    color: "#64748b",
    insight: "",
    finding: "",
    sortOrder: fallbackSortOrder,
  };
}

export function getWorkbookObservations(riskId, appName) {
  return (
    REFERENCE_DATA.workbookObservationsByRiskAndApp[riskId]?.[canonicalizeAppName(appName)] || []
  );
}

export function toApiObservationOptions(rawValue) {
  const normalized = normalizeObservationOptions(rawValue, EMPTY_OBSERVATION_OPTIONS);
  return {
    atRisk: normalized.atRisk,
    notAtRisk: normalized.reducedRisk,
  };
}

export function sanitizeContact(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : EMPTY_CONTACT;

  return {
    name: String(source.name || "").trim(),
    number: String(source.number || "").trim(),
    email: String(source.email || "").trim(),
  };
}

export function sanitizeContactList(value) {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? [value]
      : [];

  return source
    .map((item) => sanitizeContact(item))
    .filter((item) => item.name || item.number || item.email);
}

export function getPrimaryContact(value) {
  return sanitizeContactList(value)[0] || sanitizeContact(EMPTY_CONTACT);
}

export function canonicalizeObservationList(value) {
  return dedupeStrings(value);
}
