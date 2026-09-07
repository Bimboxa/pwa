import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";
import { nanoid } from "@reduxjs/toolkit";
import JSZip from "jszip";

import parseDexieExportBlob from "Features/krtoFile/utils/parseDexieExportBlob";
import remapDexieExportIds from "Features/krtoFile/utils/remapDexieExportIds";
import getImportingUserIdMaster from "Features/krtoFile/utils/getImportingUserIdMaster";
import {
  PROJECT_EXPORT_DATA_FILE,
  PROJECT_EXPORT_IMAGES_DIR,
  readProjectExportManifest,
} from "../utils/projectExportFormat";

// Loads a project export zip (see projectExportFormat / createProjectExportZip).
//
// - duplicate: false → verbatim import. Every id, owner, timestamp and
//   tombstone is written as-is (bulkPut is not intercepted by the soft-delete
//   middleware; under withSystemWrite the audit hooks keep incoming values
//   and skip the ownership / read-only guards). The caller is responsible for
//   wiping a pre-existing local copy first (deleteProjectLocalDataService)
//   when an exact replica is wanted.
// - duplicate: true → independent copy: every id regenerated and every
//   audited row re-owned to the importer (remapDexieExportIds), across ALL
//   scopes. syncFiles (keyed by path, not remapped) are dropped.
//
// Unlike loadKrtoZip this loader is multi-scope: it never forces
// points.scopeId and needs no __importTag (the projectId is known).
export default async function loadProjectExportZip(file, options) {
  if (!file) throw new Error("Fichier invalide");
  const duplicate = Boolean(options?.duplicate);

  const zip = await JSZip.loadAsync(file);
  const manifest = await readProjectExportManifest(zip);
  if (!manifest) throw new Error("Ce fichier n'est pas un export de projet");

  const jsonEntry = zip.file(PROJECT_EXPORT_DATA_FILE);
  if (!jsonEntry)
    throw new Error(`${PROJECT_EXPORT_DATA_FILE} introuvable dans le ZIP`);
  const jsonData = await parseDexieExportBlob(await jsonEntry.async("blob"));

  // Binaries stay out of the JSON (dexie-export-import's SAX parser caps a
  // text node at 10 MB); they are re-injected per row by the transform.
  const imageEntries = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.startsWith(PROJECT_EXPORT_IMAGES_DIR)
  );
  let imageBuffers = new Map();
  await Promise.all(
    imageEntries.map(async (entry) => {
      const fileName = entry.name.slice(PROJECT_EXPORT_IMAGES_DIR.length);
      imageBuffers.set(fileName, await entry.async("arraybuffer"));
    })
  );

  let projectId = manifest.projectId;

  if (duplicate) {
    // Local sync state is keyed by `path` and not remapped: a copy is a
    // brand-new local project, not linked to any remote sync.
    jsonData.data.data = jsonData.data.data.filter(
      (t) => t.tableName !== "syncFiles"
    );

    const newProjectId = nanoid();
    const { fileNameMap } = remapDexieExportIds(jsonData, {
      importingUserIdMaster: getImportingUserIdMaster(),
      // Scopes get fresh nanoids through the generic id map; only the
      // project id is pinned so the caller can find the copy.
      overrideIds: {
        projects: manifest.projectId
          ? { [manifest.projectId]: newProjectId }
          : {},
      },
    });

    const remappedBuffers = new Map();
    for (const [oldName, buffer] of imageBuffers.entries()) {
      remappedBuffers.set(fileNameMap[oldName] || oldName, buffer);
    }
    imageBuffers = remappedBuffers;

    // Identity of the copy: detach it from the référentiel (the dashboard
    // attaches remote configurations by idMaster) and mark the name.
    const projectsTable = jsonData.data.data.find(
      (t) => t.tableName === "projects"
    );
    for (const row of projectsTable?.rows ?? []) {
      if (!row) continue;
      delete row.idMaster;
      row.name = `${row.name ?? "Projet"} (copie)`;
    }

    projectId = newProjectId;
  }

  const jsonBlob = new Blob([JSON.stringify(jsonData)], {
    type: "application/json",
  });

  // withSystemWrite: rows may be owned by other users / live in private
  // scopes. withoutUndo: a whole-project import is not undoable row by row.
  await withSystemWrite(() =>
    withoutUndo(async () => {
      try {
        await db.import(jsonBlob, {
          overwriteValues: true,
          acceptVersionDiff: true,
          acceptMissingTables: true,
          chunkSizeBytes: 15 * 1024 * 1024,
          noTransaction: false,
          transform: (table, value) => {
            if (table === "files" && value?.fileName) {
              const buffer = imageBuffers.get(value.fileName);
              if (buffer) value.fileArrayBuffer = buffer;
            }
            return { value };
          },
          progressCallback: (progress) => {
            if (progress.totalRows) {
              console.log(
                `[loadProjectExportZip] ${Math.round((progress.completedRows / progress.totalRows) * 100)}%`
              );
            }
            return true;
          },
        });
      } catch (error) {
        console.error("[loadProjectExportZip] import error", error);
        throw new Error(`Import failed: ${error.message}`);
      }
    })
  );

  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error(
      `Import terminé mais le projet ${projectId} est introuvable en base`
    );
  }

  console.log("[loadProjectExportZip] import done", {
    projectId,
    duplicate,
    manifestRowCounts: manifest.rowCounts,
  });

  return { project, projectId, manifest, duplicate };
}
