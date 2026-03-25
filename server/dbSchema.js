import fs from "node:fs";
import {
  EMPTY_CONTACT,
  EMPTY_OBSERVATION_OPTIONS,
  REFERENCE_DATA,
  getRiskReference,
  getWorkbookObservations,
  normalizeObservationOptions,
  sanitizeContactList,
} from "./referenceData.js";
import {
  DB_PATH,
  buildObservationSummary,
  buildStoredObservationsForStatus,
  defaultFindingNote,
  ensureColumn,
  extractObservationSelectionsFromSummary,
  getUserTableNames,
  hasColumn,
  hasTable,
  normalizeFindingResultStatus,
  normalizeStoredObservations,
  parseJsonOrDefault,
  quoteSqlString,
} from "./dbUtils.js";

const CURRENT_TABLES = ["apps", "features", "risks", "findings"];
const TARGET_COLUMNS = {
  apps: ["id", "name", "sector", "agency", "app_version", "point_of_contact_json", "sort_order", "created_at", "updated_at"],
  features: ["id", "name", "additional_context", "demo_file_name", "demo_file_path", "sort_order", "created_at", "updated_at"],
  risks: ["id", "feature_id", "name", "description", "goal", "observation_options_json", "demo_file_name", "demo_file_path", "sort_order", "created_at", "updated_at"],
  findings: ["id", "app_id", "feature_id", "risk_id", "result_status", "result_observations_json", "note", "elaboration", "metadata", "observation_summary", "demo_file_name", "demo_file_path", "created_at", "updated_at"],
};

function getTableColumnNames(db, tableName) {
  if (!hasTable(db, tableName)) return [];
  return db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
}

function hasExactColumns(db, tableName, expectedColumns) {
  const actualColumns = getTableColumnNames(db, tableName);
  return actualColumns.length === expectedColumns.length
    && expectedColumns.every((column) => actualColumns.includes(column));
}

function sqlColumnOrFallback(db, tableName, columnName, fallbackSql, alias = columnName) {
  return hasColumn(db, tableName, columnName)
    ? `${columnName} AS ${alias}`
    : `${fallbackSql} AS ${alias}`;
}

function parseGuideText(rawValue) {
  const lines = String(rawValue || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\{([^}]+)\}/g, "$1").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return {
    description: lines[0] || "",
    goal: lines[1] || "",
  };
}

function inferRiskDescription(row, referenceRisk) {
  const guide = parseGuideText(row.consequence);
  return String(row.description || guide.description || referenceRisk?.description || row.name || "").trim();
}

function inferRiskGoal(row, referenceRisk) {
  const guide = parseGuideText(row.consequence);
  return String(guide.goal || row.goal || referenceRisk?.goal || "").trim();
}

function defaultSectorForAppName(appName) {
  const match = (REFERENCE_DATA.defaults.apps || []).find((app) => app.name === appName);
  return String(match?.sector || REFERENCE_DATA.defaults.apps?.[0]?.sector || "identity").trim();
}

function normalizeRiskObservationOptions(rawValue, referenceRisk) {
  return normalizeObservationOptions(
    parseJsonOrDefault(rawValue, referenceRisk?.observationOptions || EMPTY_OBSERVATION_OPTIONS),
    referenceRisk?.observationOptions || EMPTY_OBSERVATION_OPTIONS
  );
}

function normalizeFindingRecord(row) {
  const resultStatus =
    normalizeFindingResultStatus(row.result_status ?? row.status, row.note)
    || "pending";
  const resultObservations = row.result_observations_json != null
    ? normalizeStoredObservations(parseJsonOrDefault(row.result_observations_json, []), resultStatus)
    : normalizeStoredObservations(parseJsonOrDefault(row.observations_json, EMPTY_OBSERVATION_OPTIONS), resultStatus);

  return {
    id: row.id ?? null,
    appId: row.app_id ?? null,
    appName: row.app_name || "",
    featureId: row.feature_id,
    riskId: row.risk_id,
    resultStatus,
    resultObservations,
    note: row.note || defaultFindingNote(resultStatus),
    elaboration: row.elaboration || null,
    metadata: row.metadata || null,
    observationSummary: row.observation_summary || buildObservationSummary(row.app_name || "", resultObservations),
    demoFileName: row.demo_file_name || null,
    demoFilePath: row.demo_file_path || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

function createMigrationBackup(db) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-");
  const backupPath = DB_PATH.replace(/dashboard\.db$/i, `dashboard.pre-approved-four-table-refactor.${stamp}.backup.db`);
  if (!fs.existsSync(backupPath)) {
    db.exec(`VACUUM INTO ${quoteSqlString(backupPath)}`);
  }
}

function captureCurrentSnapshot(db) {
  const appsHasId = hasColumn(db, "apps", "id");
  const appRows = db.prepare(`
    SELECT
      ${appsHasId ? "id" : "NULL AS id"},
      name,
      ${sqlColumnOrFallback(db, "apps", "sector", "sector_id", "sector")},
      ${sqlColumnOrFallback(db, "apps", "agency", "'Unassigned Agency'")},
      ${sqlColumnOrFallback(db, "apps", "app_version", "NULL")},
      ${sqlColumnOrFallback(db, "apps", "point_of_contact_json", quoteSqlString(JSON.stringify([])))},
      ${sqlColumnOrFallback(db, "apps", "sort_order", "0")},
      ${sqlColumnOrFallback(db, "apps", "created_at", "datetime('now')")},
      ${sqlColumnOrFallback(db, "apps", "updated_at", "datetime('now')")}
    FROM apps
    ORDER BY sort_order ASC${appsHasId ? ", id ASC" : ""}
  `).all();

  const featureRows = hasTable(db, "features") ? db.prepare(`
    SELECT
      id,
      ${hasColumn(db, "features", "name") ? "name" : "description AS name"},
      ${sqlColumnOrFallback(db, "features", "additional_context", "NULL")},
      ${sqlColumnOrFallback(db, "features", "demo_file_name", "NULL")},
      ${sqlColumnOrFallback(db, "features", "demo_file_path", "NULL")},
      ${sqlColumnOrFallback(db, "features", "sort_order", "0")},
      ${sqlColumnOrFallback(db, "features", "created_at", "datetime('now')")},
      ${sqlColumnOrFallback(db, "features", "updated_at", "datetime('now')")}
    FROM features
    ORDER BY sort_order ASC, id ASC
  `).all() : [];

  const riskFeatureColumn = hasColumn(db, "risks", "feature_id") ? "feature_id" : "pf";
  const riskRows = db.prepare(`
    SELECT
      id,
      ${riskFeatureColumn} AS feature_id,
      name,
      ${sqlColumnOrFallback(db, "risks", "description", "NULL")},
      ${sqlColumnOrFallback(db, "risks", "goal", "NULL")},
      ${sqlColumnOrFallback(db, "risks", "consequence", "NULL")},
      ${sqlColumnOrFallback(db, "risks", "observation_options_json", quoteSqlString(JSON.stringify(EMPTY_OBSERVATION_OPTIONS)))},
      ${sqlColumnOrFallback(db, "risks", "demo_file_name", "NULL")},
      ${sqlColumnOrFallback(db, "risks", "demo_file_path", "NULL")},
      ${sqlColumnOrFallback(db, "risks", "sort_order", "0")},
      ${sqlColumnOrFallback(db, "risks", "created_at", "datetime('now')")},
      ${sqlColumnOrFallback(db, "risks", "updated_at", "datetime('now')")}
    FROM risks
    ORDER BY sort_order ASC, id ASC
  `).all();

  const findingsHasAppId = hasColumn(db, "findings", "app_id");
  let findingRows;
  if (findingsHasAppId) {
    findingRows = db.prepare(`
      SELECT
        f.id,
        f.app_id,
        a.name AS app_name,
        f.feature_id,
        f.risk_id,
        ${hasColumn(db, "findings", "result_status") ? "f.result_status AS result_status" : "f.status AS result_status"},
        ${hasColumn(db, "findings", "result_observations_json") ? "f.result_observations_json AS result_observations_json" : "f.observations_json AS result_observations_json"},
        ${hasColumn(db, "findings", "note") ? "f.note AS note" : "NULL AS note"},
        ${hasColumn(db, "findings", "elaboration") ? "f.elaboration AS elaboration" : "NULL AS elaboration"},
        ${hasColumn(db, "findings", "metadata") ? "f.metadata AS metadata" : "NULL AS metadata"},
        ${hasColumn(db, "findings", "observation_summary") ? "f.observation_summary AS observation_summary" : "NULL AS observation_summary"},
        ${hasColumn(db, "findings", "demo_file_name") ? "f.demo_file_name AS demo_file_name" : "NULL AS demo_file_name"},
        ${hasColumn(db, "findings", "demo_file_path") ? "f.demo_file_path AS demo_file_path" : "NULL AS demo_file_path"},
        ${hasColumn(db, "findings", "created_at") ? "f.created_at AS created_at" : "datetime('now') AS created_at"},
        ${hasColumn(db, "findings", "updated_at") ? "f.updated_at AS updated_at" : "datetime('now') AS updated_at"}
      FROM findings f
      INNER JOIN apps a ON a.id = f.app_id
      ORDER BY datetime(f.updated_at) ASC, f.id ASC
    `).all();
  } else {
    // Very old schema: primary data in app_risk_status, with risk_status_json findings as overrides
    const riskFeatureMap = Object.fromEntries(riskRows.map((r) => [r.id, r.feature_id]));
    const now = new Date().toISOString();

    // Key: "appName|riskId" → finding object (deduplicated, findings table overrides app_risk_status)
    const findingMap = new Map();

    // 1. Read from app_risk_status (primary data source for the old schema)
    if (hasTable(db, "app_risk_status")) {
      const obsMap = new Map();
      if (hasTable(db, "risk_observations")) {
        db.prepare("SELECT app_name, risk_id, observation FROM risk_observations").all().forEach((row) => {
          const key = `${row.app_name}|${row.risk_id}`;
          if (!obsMap.has(key)) obsMap.set(key, []);
          obsMap.get(key).push(row.observation);
        });
      }
      db.prepare("SELECT app_name, risk_id, status, note, elaboration FROM app_risk_status").all().forEach((row) => {
        const key = `${row.app_name}|${row.risk_id}`;
        const observations = obsMap.get(key) || [];
        findingMap.set(key, {
          id: null,
          app_id: null,
          app_name: row.app_name,
          feature_id: riskFeatureMap[row.risk_id] || null,
          risk_id: row.risk_id,
          result_status: row.status,
          result_observations_json: JSON.stringify(observations),
          note: row.note || null,
          elaboration: row.elaboration || null,
          metadata: null,
          observation_summary: null,
          demo_file_name: null,
          demo_file_path: null,
          created_at: now,
          updated_at: now,
        });
      });
    }

    // 2. Read from old findings table (risk_status_json map) — overrides app_risk_status entries
    if (hasTable(db, "findings")) {
      const oldRows = db.prepare(`
        SELECT
          id,
          ${hasColumn(db, "findings", "metadata") ? "metadata" : "NULL AS metadata"} AS app_name,
          ${hasColumn(db, "findings", "risk_status_json") ? "risk_status_json" : "NULL AS risk_status_json"} AS risk_status_json,
          ${hasColumn(db, "findings", "observations_json") ? "observations_json" : "NULL AS observations_json"} AS observations_json,
          ${hasColumn(db, "findings", "demo_file_name") ? "demo_file_name" : "NULL AS demo_file_name"} AS demo_file_name,
          ${hasColumn(db, "findings", "demo_file_path") ? "demo_file_path" : "NULL AS demo_file_path"} AS demo_file_path,
          ${hasColumn(db, "findings", "created_at") ? "created_at" : "datetime('now') AS created_at"} AS created_at
        FROM findings
        ORDER BY created_at ASC, id ASC
      `).all();
      for (const oldRow of oldRows) {
        const appName = oldRow.app_name || "";
        const statusMap = parseJsonOrDefault(oldRow.risk_status_json, {});
        const obsMap = parseJsonOrDefault(oldRow.observations_json, {});
        for (const [riskId, status] of Object.entries(statusMap)) {
          const key = `${appName}|${riskId}`;
          const observations = obsMap[riskId];
          const observationsJson = Array.isArray(observations)
            ? JSON.stringify(observations)
            : observations != null ? JSON.stringify([observations]) : "[]";
          findingMap.set(key, {
            id: null,
            app_id: null,
            app_name: appName,
            feature_id: riskFeatureMap[riskId] || null,
            risk_id: riskId,
            result_status: status,
            result_observations_json: observationsJson,
            note: null,
            elaboration: null,
            metadata: null,
            observation_summary: null,
            demo_file_name: oldRow.demo_file_name || null,
            demo_file_path: oldRow.demo_file_path || null,
            created_at: oldRow.created_at || now,
            updated_at: oldRow.created_at || now,
          });
        }
      }
    }

    findingRows = Array.from(findingMap.values());
  }

  return {
    apps: appRows.map((row, index) => ({
      id: row.id,
      name: row.name,
      sector: String(row.sector || defaultSectorForAppName(row.name)).trim(),
      agency: row.agency || "Unassigned Agency",
      appVersion: row.app_version || null,
      pointOfContacts: sanitizeContactList(parseJsonOrDefault(row.point_of_contact_json, EMPTY_CONTACT)),
      sortOrder: Number(row.sort_order ?? index),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    })),
    features: featureRows.map((row, index) => ({
      id: row.id,
      name: row.name,
      additionalContext: row.additional_context || "",
      demoFileName: row.demo_file_name || null,
      demoFilePath: row.demo_file_path || null,
      sortOrder: Number(row.sort_order ?? index),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    })),
    risks: riskRows.map((row, index) => {
      const reference = getRiskReference(row.id);
      return {
        id: row.id,
        featureId: row.feature_id,
        name: row.name || reference?.name || row.id,
        description: inferRiskDescription(row, reference),
        goal: inferRiskGoal(row, reference),
        observationOptions: normalizeRiskObservationOptions(row.observation_options_json, reference),
        demoFileName: row.demo_file_name || null,
        demoFilePath: row.demo_file_path || null,
        sortOrder: Number(row.sort_order ?? index),
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
      };
    }),
    findings: findingRows.map((row) => normalizeFindingRecord(row)),
  };
}

function insertSnapshot(db, snapshot) {
  const insertApp = db.prepare(`
    INSERT INTO apps (
      id, name, sector, agency, app_version, point_of_contact_json, sort_order, created_at, updated_at
    ) VALUES (
      @id, @name, @sector, @agency, @app_version, @point_of_contact_json, @sort_order, @created_at, @updated_at
    )
  `);
  const insertFeature = db.prepare(`
    INSERT INTO features (
      id, name, additional_context, demo_file_name, demo_file_path, sort_order, created_at, updated_at
    ) VALUES (
      @id, @name, @additional_context, @demo_file_name, @demo_file_path, @sort_order, @created_at, @updated_at
    )
  `);
  const insertRisk = db.prepare(`
    INSERT INTO risks (
      id, feature_id, name, description, goal, observation_options_json, demo_file_name, demo_file_path, sort_order, created_at, updated_at
    ) VALUES (
      @id, @feature_id, @name, @description, @goal, @observation_options_json, @demo_file_name, @demo_file_path, @sort_order, @created_at, @updated_at
    )
  `);
  const insertFinding = db.prepare(`
    INSERT OR IGNORE INTO findings (
      id, app_id, feature_id, risk_id, result_status, result_observations_json, note, elaboration, metadata,
      observation_summary, demo_file_name, demo_file_path, created_at, updated_at
    ) VALUES (
      @id, @app_id, @feature_id, @risk_id, @result_status, @result_observations_json, @note, @elaboration, @metadata,
      @observation_summary, @demo_file_name, @demo_file_path, @created_at, @updated_at
    )
  `);

  snapshot.apps
    .sort((left, right) => (left.sortOrder - right.sortOrder) || left.name.localeCompare(right.name))
    .forEach((app, index) => {
      insertApp.run({
        id: app.id ?? null,
        name: app.name,
        sector: String(app.sector || defaultSectorForAppName(app.name)).trim(),
        agency: app.agency || "Unassigned Agency",
        app_version: app.appVersion || null,
        point_of_contact_json: JSON.stringify(sanitizeContactList(app.pointOfContacts ?? app.pointOfContact)),
        sort_order: Number(app.sortOrder ?? index),
        created_at: app.createdAt || new Date().toISOString(),
        updated_at: app.updatedAt || app.createdAt || new Date().toISOString(),
      });
    });

  snapshot.features
    .sort((left, right) => (left.sortOrder - right.sortOrder) || left.id.localeCompare(right.id))
    .forEach((feature, index) => {
      insertFeature.run({
        id: feature.id,
        name: feature.name,
        additional_context: feature.additionalContext || "",
        demo_file_name: feature.demoFileName || null,
        demo_file_path: feature.demoFilePath || null,
        sort_order: Number(feature.sortOrder ?? index),
        created_at: feature.createdAt || new Date().toISOString(),
        updated_at: feature.updatedAt || feature.createdAt || new Date().toISOString(),
      });
    });

  snapshot.risks
    .sort((left, right) => (left.sortOrder - right.sortOrder) || left.id.localeCompare(right.id))
    .forEach((risk, index) => {
      insertRisk.run({
        id: risk.id,
        feature_id: risk.featureId,
        name: risk.name,
        description: risk.description,
        goal: risk.goal || "",
        observation_options_json: JSON.stringify(normalizeObservationOptions(risk.observationOptions, EMPTY_OBSERVATION_OPTIONS)),
        demo_file_name: risk.demoFileName || null,
        demo_file_path: risk.demoFilePath || null,
        sort_order: Number(risk.sortOrder ?? index),
        created_at: risk.createdAt || new Date().toISOString(),
        updated_at: risk.updatedAt || risk.createdAt || new Date().toISOString(),
      });
    });

  const appNameToId = Object.fromEntries(
    db.prepare("SELECT id, name FROM apps").all().map((a) => [a.name, a.id])
  );

  snapshot.findings.forEach((finding) => {
    const appId = finding.appId ?? appNameToId[finding.appName] ?? null;
    if (appId == null) return;
    insertFinding.run({
      id: finding.id ?? null,
      app_id: appId,
      feature_id: finding.featureId,
      risk_id: finding.riskId,
      result_status: normalizeFindingResultStatus(finding.resultStatus, finding.note) || "pending",
      result_observations_json: JSON.stringify(buildStoredObservationsForStatus(null, finding.resultObservations)),
      note: finding.note || defaultFindingNote(finding.resultStatus),
      elaboration: finding.elaboration || null,
      metadata: finding.metadata || null,
      observation_summary: finding.observationSummary || buildObservationSummary(finding.appName || "", finding.resultObservations),
      demo_file_name: finding.demoFileName || null,
      demo_file_path: finding.demoFilePath || null,
      created_at: finding.createdAt || new Date().toISOString(),
      updated_at: finding.updatedAt || finding.createdAt || new Date().toISOString(),
    });
  });
}

export function createTables(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sector TEXT NOT NULL,
      agency TEXT NOT NULL,
      app_version TEXT,
      point_of_contact_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      additional_context TEXT,
      demo_file_name TEXT,
      demo_file_path TEXT,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS risks (
      id TEXT PRIMARY KEY,
      feature_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      goal TEXT NOT NULL,
      observation_options_json TEXT NOT NULL,
      demo_file_name TEXT,
      demo_file_path TEXT,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      feature_id TEXT NOT NULL,
      risk_id TEXT NOT NULL,
      result_status TEXT NOT NULL,
      result_observations_json TEXT NOT NULL,
      note TEXT,
      elaboration TEXT,
      metadata TEXT,
      observation_summary TEXT,
      demo_file_name TEXT,
      demo_file_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (app_id, risk_id),
      FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
      FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
      FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE CASCADE
    );
  `);
}

export function ensureCurrentSchemaColumns(db) {
  ensureColumn(db, "apps", "sector", "TEXT NOT NULL DEFAULT 'identity'");
  ensureColumn(db, "apps", "agency", "TEXT NOT NULL DEFAULT 'Unassigned Agency'");
  ensureColumn(db, "apps", "app_version", "TEXT");
  ensureColumn(db, "apps", "point_of_contact_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "apps", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "apps", "created_at", "TEXT NOT NULL DEFAULT (datetime('now'))");
  ensureColumn(db, "apps", "updated_at", "TEXT NOT NULL DEFAULT (datetime('now'))");

  ensureColumn(db, "features", "additional_context", "TEXT");
  ensureColumn(db, "features", "demo_file_name", "TEXT");
  ensureColumn(db, "features", "demo_file_path", "TEXT");
  ensureColumn(db, "features", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "features", "created_at", "TEXT NOT NULL DEFAULT (datetime('now'))");
  ensureColumn(db, "features", "updated_at", "TEXT NOT NULL DEFAULT (datetime('now'))");

  ensureColumn(db, "risks", "feature_id", "TEXT");
  ensureColumn(db, "risks", "description", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "risks", "goal", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "risks", "observation_options_json", `TEXT NOT NULL DEFAULT '${JSON.stringify(EMPTY_OBSERVATION_OPTIONS)}'`);
  ensureColumn(db, "risks", "demo_file_name", "TEXT");
  ensureColumn(db, "risks", "demo_file_path", "TEXT");
  ensureColumn(db, "risks", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "risks", "created_at", "TEXT NOT NULL DEFAULT (datetime('now'))");
  ensureColumn(db, "risks", "updated_at", "TEXT NOT NULL DEFAULT (datetime('now'))");

  ensureColumn(db, "findings", "result_status", "TEXT NOT NULL DEFAULT 'pending'");
  ensureColumn(db, "findings", "result_observations_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "findings", "note", "TEXT");
  ensureColumn(db, "findings", "elaboration", "TEXT");
  ensureColumn(db, "findings", "metadata", "TEXT");
  ensureColumn(db, "findings", "observation_summary", "TEXT");
  ensureColumn(db, "findings", "demo_file_name", "TEXT");
  ensureColumn(db, "findings", "demo_file_path", "TEXT");
  ensureColumn(db, "findings", "created_at", "TEXT NOT NULL DEFAULT (datetime('now'))");
  ensureColumn(db, "findings", "updated_at", "TEXT NOT NULL DEFAULT (datetime('now'))");
}

export function isCurrentFourTableSchema(db) {
  const tableNames = new Set(getUserTableNames(db));
  return CURRENT_TABLES.every((tableName) => tableNames.has(tableName))
    && CURRENT_TABLES.every((tableName) => hasExactColumns(db, tableName, TARGET_COLUMNS[tableName]));
}

export function needsSchemaMigration(db) {
  const tableNames = getUserTableNames(db);
  if (tableNames.length === 0) {
    return false;
  }
  return !isCurrentFourTableSchema(db);
}

export function hydrateReferenceMetadata(db) {
  const insertFeatureIfMissing = db.prepare(`
    INSERT OR IGNORE INTO features (id, name, additional_context, sort_order, created_at, updated_at)
    VALUES (@id, @name, @additional_context, @sort_order, datetime('now'), datetime('now'))
  `);
  const updateFeature = db.prepare(`
    UPDATE features
    SET name = CASE WHEN trim(COALESCE(name, '')) = '' THEN @name ELSE name END,
        additional_context = CASE WHEN trim(COALESCE(additional_context, '')) = '' THEN @additional_context ELSE additional_context END,
        updated_at = @updated_at
    WHERE id = @id
  `);
  REFERENCE_DATA.platformFeatures.forEach((feature) => {
    insertFeatureIfMissing.run({
      id: feature.id,
      name: feature.name,
      additional_context: feature.additionalContext || "",
      sort_order: feature.sortOrder ?? 0,
    });
    updateFeature.run({
      id: feature.id,
      name: feature.name,
      additional_context: feature.additionalContext || "",
      updated_at: new Date().toISOString(),
    });
  });

  const updateRisk = db.prepare(`
    UPDATE risks
    SET feature_id = CASE WHEN trim(COALESCE(feature_id, '')) = '' THEN @feature_id ELSE feature_id END,
        name = CASE WHEN trim(COALESCE(name, '')) = '' THEN @name ELSE name END,
        description = CASE WHEN trim(COALESCE(description, '')) = '' THEN @description ELSE description END,
        goal = CASE WHEN trim(COALESCE(goal, '')) = '' THEN @goal ELSE goal END,
        observation_options_json = @observation_options_json,
        updated_at = @updated_at
    WHERE id = @id
  `);
  REFERENCE_DATA.risks.forEach((risk) => {
    updateRisk.run({
      id: risk.id,
      feature_id: risk.featureId,
      name: risk.name,
      description: risk.description,
      goal: risk.goal,
      observation_options_json: JSON.stringify(risk.observationOptions),
      updated_at: new Date().toISOString(),
    });
  });

  const updateApp = db.prepare(`
    UPDATE apps
    SET sector = @sector,
        point_of_contact_json = @point_of_contact_json,
        updated_at = @updated_at
    WHERE id = @id
  `);
  db.prepare("SELECT id, name, sector, point_of_contact_json FROM apps").all().forEach((app) => {
    updateApp.run({
      id: app.id,
      sector: String(app.sector || defaultSectorForAppName(app.name)).trim(),
      point_of_contact_json: JSON.stringify(sanitizeContactList(parseJsonOrDefault(app.point_of_contact_json, EMPTY_CONTACT))),
      updated_at: new Date().toISOString(),
    });
  });
}

export function migrateSchema(db) {
  const snapshot = captureCurrentSnapshot(db);
  createMigrationBackup(db);

  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      getUserTableNames(db).forEach((tableName) => {
        db.exec(`DROP TABLE IF EXISTS "${tableName.replace(/"/g, "\"\"")}"`);
      });
      createTables(db);
      ensureCurrentSchemaColumns(db);
      insertSnapshot(db, snapshot);
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

export function seedDefaultsIfEmpty(db) {
  const riskCount = db.prepare("SELECT COUNT(*) AS c FROM risks").get().c;
  if (riskCount > 0) {
    return;
  }

  const apps = (REFERENCE_DATA.defaults.apps || []).map((app, index) => ({
    id: null,
    name: app.name,
    sector: String(app.sector || defaultSectorForAppName(app.name)).trim(),
    agency: app.agency || "Unassigned Agency",
    appVersion: app.appVersion || null,
    pointOfContacts: [],
    sortOrder: index,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  const features = REFERENCE_DATA.platformFeatures.map((feature) => ({
    id: feature.id,
    name: feature.name,
    additionalContext: feature.additionalContext,
    demoFileName: null,
    demoFilePath: null,
    sortOrder: feature.sortOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  const risks = REFERENCE_DATA.risks.map((risk) => ({
    id: risk.id,
    featureId: risk.featureId,
    name: risk.name,
    description: risk.description,
    goal: risk.goal,
    observationOptions: risk.observationOptions,
    demoFileName: null,
    demoFilePath: null,
    sortOrder: risk.sortOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  const findings = [];

  apps.forEach((app) => {
    const statusMap = (REFERENCE_DATA.defaults.apps || []).find((value) => value.name === app.name)?.status || {};
    risks.forEach((risk) => {
      const [legacyStatus = "blocked", note = "Pending assessment", elaboration = null] = statusMap[risk.id] || ["blocked", "Pending assessment"];
      const resultStatus = normalizeFindingResultStatus(legacyStatus, note) || "pending";
      const workbookObservations = getWorkbookObservations(risk.id, app.name);
      const observationSummary =
        REFERENCE_DATA.defaults.riskObservations?.[risk.id]?.[app.name]
        || buildObservationSummary(app.name, workbookObservations);
      const resultObservations = workbookObservations.length > 0
        ? workbookObservations
        : extractObservationSelectionsFromSummary(observationSummary, risk.observationOptions);

      findings.push({
        id: null,
        appId: null,
        appName: app.name,
        featureId: risk.featureId,
        riskId: risk.id,
        resultStatus,
        resultObservations,
        note,
        elaboration,
        metadata: app.appVersion ? `${app.name} (v${app.appVersion})` : app.name,
        observationSummary,
        demoFileName: null,
        demoFilePath: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  });

  db.transaction(() => {
    createTables(db);
    insertSnapshot(db, { apps, features, risks, findings: [] });
    const appIdByName = new Map(db.prepare("SELECT id, name FROM apps").all().map((row) => [row.name, row.id]));
    findings.forEach((finding) => {
      db.prepare(`
        INSERT INTO findings (
          app_id, feature_id, risk_id, result_status, result_observations_json, note, elaboration, metadata,
          observation_summary, demo_file_name, demo_file_path, created_at, updated_at
        ) VALUES (
          @app_id, @feature_id, @risk_id, @result_status, @result_observations_json, @note, @elaboration, @metadata,
          @observation_summary, @demo_file_name, @demo_file_path, @created_at, @updated_at
        )
      `).run({
        app_id: appIdByName.get(finding.appName),
        feature_id: finding.featureId,
        risk_id: finding.riskId,
        result_status: finding.resultStatus,
        result_observations_json: JSON.stringify(buildStoredObservationsForStatus(null, finding.resultObservations)),
        note: finding.note,
        elaboration: finding.elaboration,
        metadata: finding.metadata,
        observation_summary: finding.observationSummary,
        demo_file_name: null,
        demo_file_path: null,
        created_at: finding.createdAt,
        updated_at: finding.updatedAt,
      });
    });
  })();
}
