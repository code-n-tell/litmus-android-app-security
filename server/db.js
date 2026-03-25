import Database from "better-sqlite3";
import {
  createTables,
  ensureCurrentSchemaColumns,
  hydrateReferenceMetadata,
  migrateSchema,
  needsSchemaMigration,
  seedDefaultsIfEmpty,
} from "./dbSchema.js";
import {
  createFinding,
  createPlatformFeature,
  createRisk,
  deletePlatformFeature,
  deleteRisk,
  getDashboardData,
  listFindings,
  updateRiskText,
} from "./dbQueries.js";
import { DB_PATH, ensureDataDirectory } from "./dbUtils.js";

export {
  createFinding,
  createPlatformFeature,
  createRisk,
  deletePlatformFeature,
  deleteRisk,
  getDashboardData,
  listFindings,
  updateRiskText,
};

export function initDb() {
  ensureDataDirectory();
  const db = new Database(DB_PATH);

  if (needsSchemaMigration(db)) {
    migrateSchema(db);
  }

  createTables(db);
  ensureCurrentSchemaColumns(db);
  hydrateReferenceMetadata(db);
  seedDefaultsIfEmpty(db);
  return db;
}
