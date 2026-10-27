import { nanoid } from "@reduxjs/toolkit";
import db from "App/db/db";
import createScanResourceStore from "./createScanResourceStore";
import { listLegacyProjectScans, getLocalScanSource } from "./localScanStore";

const store = createScanResourceStore(db, nanoid);
export default store;
export async function listAvailableScans(projectId) {
  const resources = await store.list(projectId);
  const migrated = new Set(resources.map((row) => row.legacyScanKey));
  const legacy = (await listLegacyProjectScans(projectId))
    .filter((row) => !migrated.has(row.contextKey))
    .map((row) => ({ ...row, id: row.contextKey, legacy: true }));
  return [...resources, ...legacy];
}
export function getAvailableScanSource(row) {
  return row.legacy ? getLocalScanSource(row.contextKey) : store.source(row);
}
