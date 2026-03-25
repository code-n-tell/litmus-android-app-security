import fs from "node:fs";
import {
  EMPTY_CONTACT,
  EMPTY_OBSERVATION_OPTIONS,
  REFERENCE_DATA,
  getPrimaryContact,
  getRiskSeverity,
  getSectorPresentation,
  sanitizeContactList,
  toApiObservationOptions,
} from "./referenceData.js";
import {
  buildObservationSummary,
  coerceObservationInput,
  normalizeFindingResultStatus,
  normalizePlatformFeatureId,
  normalizeStoredObservationOptions,
  normalizeStoredObservations,
  parseJsonOrDefault,
  parseRiskIdentifier,
  persistDemoFile,
  toDashboardStatusTuple,
  toPlatformFeatureSlug,
  toRiskSlug,
  toStoredObservationsJson,
} from "./dbUtils.js";

function parseContactJson(rawJson) {
  const parsed = parseJsonOrDefault(rawJson, EMPTY_CONTACT);
  const pointOfContacts = sanitizeContactList(parsed);
  return {
    pointOfContacts,
    pointOfContact: getPrimaryContact(pointOfContacts),
  };
}

function buildSectorList(appRows) {
  const sectors = new Map();

  appRows.forEach((app, index) => {
    if (sectors.has(app.sector)) return;
    const sector = getSectorPresentation(app.sector, index);
    sectors.set(app.sector, sector);
  });

  return [...sectors.values()]
    .sort((left, right) => (left.sortOrder - right.sortOrder) || left.name.localeCompare(right.name))
    .map((sector) => ({
      id: sector.id,
      name: sector.name,
      color: sector.color,
      insight: sector.insight,
      finding: sector.finding,
    }));
}

function buildGuideText(row) {
  return [row.description, row.goal].filter(Boolean).join("\n");
}

function validateObservationSelection(riskRow, resultStatus, selectedObservations) {
  const observationOptions = normalizeStoredObservationOptions(
    parseJsonOrDefault(riskRow.observation_options_json, EMPTY_OBSERVATION_OPTIONS)
  );
  const allowedOptions = resultStatus === "at-risk"
    ? observationOptions.atRisk
    : resultStatus === "reduced-risk"
      ? observationOptions.reducedRisk
      : [];

  const invalidSelections = selectedObservations.filter((value) => !allowedOptions.includes(value));
  if (invalidSelections.length > 0) {
    throw new Error(`Observations for ${riskRow.id} do not match the selected status.`);
  }
}

export function getDashboardData(db) {
  const featureRows = db.prepare(`
    SELECT id, name, additional_context, demo_file_name, demo_file_path, created_at
    FROM features
    ORDER BY sort_order ASC, id ASC
  `).all();

  const riskRows = db.prepare(`
    SELECT id, feature_id, name, description, goal, observation_options_json
    FROM risks
    ORDER BY sort_order ASC, id ASC
  `).all();

  const appRows = db.prepare(`
    SELECT id, name, sector, agency, app_version, point_of_contact_json, sort_order
    FROM apps
    ORDER BY sort_order ASC, id ASC
  `).all();

  const findingRows = db.prepare(`
    SELECT app_id, risk_id, result_status, note, elaboration, observation_summary
    FROM findings
  `).all();

  const appNameById = new Map(appRows.map((app) => [app.id, app.name]));
  const statusByAppId = new Map();
  const riskObservations = {};

  findingRows.forEach((row) => {
    if (!statusByAppId.has(row.app_id)) {
      statusByAppId.set(row.app_id, {});
    }

    statusByAppId.get(row.app_id)[row.risk_id] = toDashboardStatusTuple(
      row.result_status,
      row.note,
      row.elaboration
    );

    if (row.observation_summary) {
      const appName = appNameById.get(row.app_id);
      if (!appName) return;
      if (!riskObservations[row.risk_id]) {
        riskObservations[row.risk_id] = {};
      }
      riskObservations[row.risk_id][appName] = row.observation_summary;
    }
  });

  return {
    platformFeatures: featureRows.map((row) => ({
      id: row.id,
      name: row.name,
      additionalContext: row.additional_context || "",
      demoFileName: row.demo_file_name || null,
      demoFilePath: row.demo_file_path || null,
      createdAt: row.created_at,
    })),
    risks: riskRows.map((row) => ({
      id: row.id,
      pf: row.feature_id,
      name: row.name,
      severity: getRiskSeverity(row.id),
      goal: row.goal,
      elaboration: row.description,
    })),
    riskConsequences: Object.fromEntries(
      riskRows.map((row) => [row.id, buildGuideText(row)])
    ),
    riskObservations,
    riskCallToAction: {},
    riskNoteFormatted: {},
    afObservationOptions: Object.fromEntries(
      riskRows.map((row) => [
        row.id,
        toApiObservationOptions(parseJsonOrDefault(row.observation_options_json, EMPTY_OBSERVATION_OPTIONS)),
      ])
    ),
    apps: appRows.map((app) => {
      const status = { ...(statusByAppId.get(app.id) || {}) };
      riskRows.forEach((risk) => {
        if (!status[risk.id]) {
          status[risk.id] = toDashboardStatusTuple("pending", "Pending assessment");
        }
      });

      return {
        id: app.id,
        name: app.name,
        agency: app.agency,
        sector: app.sector,
        appVersion: app.app_version || null,
        ...parseContactJson(app.point_of_contact_json),
        status,
      };
    }),
    sectors: buildSectorList(appRows),
  };
}

export function createPlatformFeature(db, payload) {
  const featureInput = payload.platformFeatureId ?? payload.pf ?? payload.pfId;
  const normalizedFeatureId = normalizePlatformFeatureId(featureInput);
  const name = String(payload.name || payload.description || "").trim();
  const additionalContext = String(payload.additionalContext || "").trim();

  const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
  };

  if (!normalizedFeatureId) {
    fail("`platformFeatureId` must follow PF-XX or platform-feature-XX format.");
  }
  if (!name) {
    fail("`name` is required.");
  }

  const exists = db.prepare("SELECT 1 FROM features WHERE id = ?").get(normalizedFeatureId);
  if (exists) {
    fail(`Platform feature ${toPlatformFeatureSlug(normalizedFeatureId)} already exists.`, 409);
  }

  const storedDemo = persistDemoFile(payload);
  try {
    const timestamp = new Date().toISOString();
    const nextSort = db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM features").get().next;
    db.prepare(`
      INSERT INTO features (id, name, additional_context, demo_file_name, demo_file_path, sort_order, created_at, updated_at)
      VALUES (@id, @name, @additional_context, @demo_file_name, @demo_file_path, @sort_order, @created_at, @updated_at)
    `).run({
      id: normalizedFeatureId,
      name,
      additional_context: additionalContext || null,
      demo_file_name: storedDemo.demoFileName,
      demo_file_path: storedDemo.demoFilePath,
      sort_order: nextSort,
      created_at: timestamp,
      updated_at: timestamp,
    });
  } catch (error) {
    if (storedDemo.absolutePath && fs.existsSync(storedDemo.absolutePath)) {
      fs.unlinkSync(storedDemo.absolutePath);
    }
    throw error;
  }

  const created = db.prepare(`
    SELECT id, name, additional_context, demo_file_name, demo_file_path, created_at
    FROM features
    WHERE id = ?
  `).get(normalizedFeatureId);

  return {
    ...created,
    publicId: toPlatformFeatureSlug(created.id),
  };
}

export function createRisk(db, payload) {
  const featureInput = payload.pf ?? payload.platformFeatureId ?? payload.pfId;
  const normalizedFeatureId = normalizePlatformFeatureId(featureInput);
  const parsedRisk = parseRiskIdentifier(payload.riskId, normalizedFeatureId);

  const featureId = normalizedFeatureId || parsedRisk?.featureId || "";
  const riskId = parsedRisk?.riskId || String(payload.riskId || "").trim().toUpperCase();
  const description = String(payload.description || "").trim();
  const providedName = String(payload.name || "").trim();
  const name = providedName || description;
  const goal = String(payload.goal || "").trim();
  const observationOptions = normalizeStoredObservationOptions(
    payload.observationOptions || EMPTY_OBSERVATION_OPTIONS
  );

  const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
  };

  if (!/^PF-\d{2}$/.test(featureId)) {
    fail("`platformFeatureId` must follow PF-XX or platform-feature-XX format.");
  }
  if (!/^PF-\d{2}-R\d{2}$/.test(riskId)) {
    fail("`riskId` must follow PF-XX-RZZ, platform-feature-XX-risk-ZZ, or risk-ZZ (when platform feature is provided).");
  }
  if (!riskId.startsWith(`${featureId}-`)) {
    fail("`riskId` must match the same platform feature prefix as `pf`.");
  }
  if (!description) {
    fail("`description` is required.");
  }

  const featureExists = db.prepare("SELECT 1 FROM features WHERE id = ?").get(featureId);
  if (!featureExists) {
    fail(`Platform feature ${toPlatformFeatureSlug(featureId)} does not exist. Add the platform feature first.`, 404);
  }

  const exists = db.prepare("SELECT 1 FROM risks WHERE id = ?").get(riskId);
  if (exists) {
    fail(`Risk ${toRiskSlug(riskId)} already exists.`, 409);
  }

  const appRows = db.prepare("SELECT id, name, app_version FROM apps ORDER BY sort_order ASC, id ASC").all();
  const storedDemo = persistDemoFile(payload);
  try {
    db.transaction(() => {
      const timestamp = new Date().toISOString();
      const nextSort = db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM risks").get().next;
      db.prepare(`
        INSERT INTO risks (
          id, feature_id, name, description, goal, observation_options_json,
          demo_file_name, demo_file_path, sort_order, created_at, updated_at
        ) VALUES (
          @id, @feature_id, @name, @description, @goal, @observation_options_json,
          @demo_file_name, @demo_file_path, @sort_order, @created_at, @updated_at
        )
      `).run({
        id: riskId,
        feature_id: featureId,
        name,
        description,
        goal,
        observation_options_json: JSON.stringify(observationOptions),
        demo_file_name: storedDemo.demoFileName,
        demo_file_path: storedDemo.demoFilePath,
        sort_order: nextSort,
        created_at: timestamp,
        updated_at: timestamp,
      });

      const insertPendingFinding = db.prepare(`
        INSERT INTO findings (
          app_id, feature_id, risk_id, result_status, result_observations_json, note, elaboration, metadata,
          observation_summary, demo_file_name, demo_file_path, created_at, updated_at
        ) VALUES (
          @app_id, @feature_id, @risk_id, 'pending', '[]', 'Pending assessment', NULL, @metadata,
          NULL, NULL, NULL, @created_at, @updated_at
        )
        ON CONFLICT(app_id, risk_id) DO NOTHING
      `);

      appRows.forEach((app) => {
        insertPendingFinding.run({
          app_id: app.id,
          feature_id: featureId,
          risk_id: riskId,
          metadata: app.app_version ? `${app.name} (v${app.app_version})` : app.name,
          created_at: timestamp,
          updated_at: timestamp,
        });
      });
    })();
  } catch (error) {
    if (storedDemo.absolutePath && fs.existsSync(storedDemo.absolutePath)) {
      fs.unlinkSync(storedDemo.absolutePath);
    }
    throw error;
  }

  const created = db.prepare(`
    SELECT id, feature_id, name, description, goal, observation_options_json, demo_file_name, demo_file_path, sort_order
    FROM risks
    WHERE id = ?
  `).get(riskId);

  return {
    ...created,
    severity: getRiskSeverity(created.id),
    elaboration: created.description,
    publicId: toRiskSlug(created.id),
    publicPfId: toPlatformFeatureSlug(created.feature_id),
  };
}

export function createFinding(db, payload) {
  const metadata = String(payload.metadata || "").trim();
  const appName = String(payload.appName || "").trim();
  const submittedRiskStatus =
    payload.riskStatus && typeof payload.riskStatus === "object"
      ? payload.riskStatus
      : {};
  const submittedObservations =
    payload.observations && typeof payload.observations === "object"
      ? payload.observations
      : {};

  const storedDemo = persistDemoFile(payload);
  try {
    return db.transaction(() => {
      if (!appName) {
        throw new Error("`appName` is required when creating finding rows.");
      }

      const riskRows = db.prepare(`
        SELECT id, feature_id, observation_options_json
        FROM risks
        ORDER BY sort_order ASC, id ASC
      `).all();

      const existingApp = db.prepare(`
        SELECT id, name, sector, agency, app_version, point_of_contact_json, sort_order
        FROM apps
        WHERE name = ?
      `).get(appName);

      const defaultSector = db.prepare("SELECT sector FROM apps ORDER BY sort_order ASC, id ASC LIMIT 1").get()?.sector
        || REFERENCE_DATA.defaults.apps?.[0]?.sector
        || "identity";
      const requestedSector = String(payload.sectorId || payload.sector || existingApp?.sector || defaultSector).trim();
      const agency = String(payload.agency || existingApp?.agency || "Unassigned Agency").trim() || "Unassigned Agency";
      const requestedAppVersion = payload.appVersion == null ? "" : String(payload.appVersion).trim();
      const appVersion = requestedAppVersion || existingApp?.app_version || null;
      const pointOfContacts = sanitizeContactList(
        payload.pointOfContacts
        ?? payload.pointOfContact
        ?? parseJsonOrDefault(existingApp?.point_of_contact_json, EMPTY_CONTACT)
      );
      const timestamp = new Date().toISOString();

      let appId = existingApp?.id;
      if (existingApp) {
        db.prepare(`
          UPDATE apps
          SET sector = @sector,
              agency = @agency,
              app_version = @app_version,
              point_of_contact_json = @point_of_contact_json,
              updated_at = @updated_at
          WHERE id = @id
        `).run({
          id: existingApp.id,
          sector: requestedSector,
          agency,
          app_version: appVersion,
          point_of_contact_json: JSON.stringify(pointOfContacts),
          updated_at: timestamp,
        });
      } else {
        const result = db.prepare(`
          INSERT INTO apps (
            name, sector, agency, app_version, point_of_contact_json, sort_order, created_at, updated_at
          ) VALUES (
            @name, @sector, @agency, @app_version, @point_of_contact_json, @sort_order, @created_at, @updated_at
          )
        `).run({
          name: appName,
          sector: requestedSector,
          agency,
          app_version: appVersion,
          point_of_contact_json: JSON.stringify(pointOfContacts),
          sort_order: db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM apps").get().next,
          created_at: timestamp,
          updated_at: timestamp,
        });
        appId = Number(result.lastInsertRowid);
      }

      const existingFindings = new Map(
        db.prepare("SELECT id, risk_id, observation_summary FROM findings WHERE app_id = ?").all(appId).map((row) => [row.risk_id, row])
      );

      const upsertFinding = db.prepare(`
        INSERT INTO findings (
          app_id, feature_id, risk_id, result_status, result_observations_json, note, elaboration, metadata,
          observation_summary, demo_file_name, demo_file_path, created_at, updated_at
        ) VALUES (
          @app_id, @feature_id, @risk_id, @result_status, @result_observations_json, @note, @elaboration, @metadata,
          @observation_summary, @demo_file_name, @demo_file_path, @created_at, @updated_at
        )
        ON CONFLICT(app_id, risk_id) DO UPDATE SET
          feature_id = excluded.feature_id,
          result_status = excluded.result_status,
          result_observations_json = excluded.result_observations_json,
          note = excluded.note,
          elaboration = excluded.elaboration,
          metadata = excluded.metadata,
          observation_summary = excluded.observation_summary,
          demo_file_name = COALESCE(excluded.demo_file_name, findings.demo_file_name),
          demo_file_path = COALESCE(excluded.demo_file_path, findings.demo_file_path),
          updated_at = excluded.updated_at
      `);

      const insertPendingFinding = db.prepare(`
        INSERT INTO findings (
          app_id, feature_id, risk_id, result_status, result_observations_json, note, elaboration, metadata,
          observation_summary, demo_file_name, demo_file_path, created_at, updated_at
        ) VALUES (
          @app_id, @feature_id, @risk_id, 'pending', '[]', 'Pending assessment', NULL, @metadata,
          NULL, NULL, NULL, @created_at, @updated_at
        )
        ON CONFLICT(app_id, risk_id) DO NOTHING
      `);

      let updatedRiskCount = 0;
      riskRows.forEach((risk) => {
        const requestedStatus = normalizeFindingResultStatus(submittedRiskStatus[risk.id]);
        const metadataValue = metadata || (appVersion ? `${appName} (v${appVersion})` : appName);

        if (requestedStatus === "at-risk" || requestedStatus === "reduced-risk") {
          const observations = coerceObservationInput(submittedObservations[risk.id]);
          validateObservationSelection(risk, requestedStatus, observations);
          const observationSummary =
            buildObservationSummary(appName, observations)
            || existingFindings.get(risk.id)?.observation_summary
            || null;

          upsertFinding.run({
            app_id: appId,
            feature_id: risk.feature_id,
            risk_id: risk.id,
            result_status: requestedStatus,
            result_observations_json: toStoredObservationsJson(observations),
            note: requestedStatus === "at-risk"
              ? "At risk (added via Add Findings)"
              : "Reduced risk (added via Add Findings)",
            elaboration: null,
            metadata: metadataValue,
            observation_summary: observationSummary,
            demo_file_name: storedDemo.demoFileName,
            demo_file_path: storedDemo.demoFilePath,
            created_at: timestamp,
            updated_at: timestamp,
          });
          updatedRiskCount += 1;
          return;
        }

        if (!existingFindings.has(risk.id)) {
          insertPendingFinding.run({
            app_id: appId,
            feature_id: risk.feature_id,
            risk_id: risk.id,
            metadata: metadataValue,
            created_at: timestamp,
            updated_at: timestamp,
          });
        }
      });

      return {
        appName,
        metadata: metadata || (appVersion ? `${appName} (v${appVersion})` : appName),
        riskStatus: submittedRiskStatus,
        observations: submittedObservations,
        demoFileName: storedDemo.demoFileName,
        demoFilePath: storedDemo.demoFilePath,
        updatedRiskCount,
        createdAt: timestamp,
      };
    })();
  } catch (error) {
    if (storedDemo.absolutePath && fs.existsSync(storedDemo.absolutePath)) {
      fs.unlinkSync(storedDemo.absolutePath);
    }
    throw error;
  }
}

export function listFindings(db) {
  const rows = db.prepare(`
    SELECT f.id, a.id AS app_id, a.name AS app_name, a.agency, a.sector, f.feature_id, f.risk_id,
           f.result_status, f.result_observations_json, f.note, f.elaboration, f.metadata, f.observation_summary,
           f.demo_file_name, f.demo_file_path, f.created_at, f.updated_at
    FROM findings f
    INNER JOIN apps a ON a.id = f.app_id
    ORDER BY datetime(f.updated_at) DESC, f.id DESC
  `).all();

  return rows.map((row) => ({
    id: row.id,
    appId: row.app_id,
    appName: row.app_name,
    agency: row.agency,
    sector: row.sector,
    featureId: row.feature_id,
    riskId: row.risk_id,
    status: row.result_status,
    observations: normalizeStoredObservations(parseJsonOrDefault(row.result_observations_json, []), row.result_status),
    note: row.note,
    elaboration: row.elaboration,
    metadata: row.metadata,
    observationSummary: row.observation_summary,
    demoFileName: row.demo_file_name,
    demoFilePath: row.demo_file_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function updateRiskText(db, riskId, patch) {
  const allowed = {
    name: "name",
    description: "description",
    goal: "goal",
  };

  const entries = Object.entries(patch).filter(
    ([key, value]) => allowed[key] && typeof value === "string"
  );
  if (entries.length === 0) {
    return null;
  }

  const setClauses = entries.map(([key]) => `${allowed[key]} = @${allowed[key]}`);
  const params = Object.fromEntries(entries.map(([key, value]) => [allowed[key], value]));
  params.id = riskId;

  db.prepare(`UPDATE risks SET ${setClauses.join(", ")} WHERE id = @id`).run(params);

  return db.prepare(`
    SELECT id, feature_id, name, description, goal
    FROM risks
    WHERE id = ?
  `).get(riskId);
}

export function deletePlatformFeature(db, featureId) {
  const id = String(featureId || "").trim().toUpperCase();
  const exists = db.prepare("SELECT 1 FROM features WHERE id = ?").get(id);
  if (!exists) {
    const error = new Error(`Platform feature ${id} not found.`);
    error.status = 404;
    throw error;
  }
  db.transaction(() => {
    const riskIds = db.prepare("SELECT id FROM risks WHERE feature_id = ?").all(id).map(r => r.id);
    for (const riskId of riskIds) {
      db.prepare("DELETE FROM findings WHERE risk_id = ?").run(riskId);
    }
    db.prepare("DELETE FROM risks WHERE feature_id = ?").run(id);
    db.prepare("DELETE FROM features WHERE id = ?").run(id);
  })();
}

export function deleteRisk(db, riskId) {
  const id = String(riskId || "").trim().toUpperCase();
  const exists = db.prepare("SELECT 1 FROM risks WHERE id = ?").get(id);
  if (!exists) {
    const error = new Error(`Risk ${id} not found.`);
    error.status = 404;
    throw error;
  }
  db.transaction(() => {
    db.prepare("DELETE FROM findings WHERE risk_id = ?").run(id);
    db.prepare("DELETE FROM risks WHERE id = ?").run(id);
  })();
}
