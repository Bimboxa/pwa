import db from "App/db/db";
import resolveTemplate from "../utils/resolveTemplate";

/**
 * Helper to group entries by keys
 */
function groupBy(entries, keys) {
  const map = new Map();
  for (const item of entries) {
    const key = keys.map((k) => item[k]).join("::");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/**
 * Build localFilter based on filterEntries and context
 */
function buildFilter(filterEntries, entry, context) {
  const localFilter = {};
  for (const rule of filterEntries) {
    if (rule.value) {
      const value = rule.value.split(".").reduce((acc, k) => acc?.[k], context);
      localFilter[rule.key] = value;
    } else if (entry) {
      localFilter[rule.key] = entry[rule.key];
    }
  }
  return localFilter;
}

/**
 * Try to parse id from full path using a template like "_listing_{{id}}.json"
 */
function extractKeyFromTemplate(path, template, key) {
  if (!template.includes(`{{${key}}}`)) return null;
  const regex = template.replace(`{{${key}}}`, "(.*?)").replace(/\./g, "\\.");
  const match = path.match(new RegExp(regex));
  return match?.[1] || null;
}

export default async function resolveSyncTasks(
  config,
  context,
  remoteProvider
) {
  const {
    localTable,
    syncFileType,
    direction,
    remoteToLocal = {},
    localToRemote = {},
  } = config;

  const fetchMode = remoteToLocal.fetchMode || "FILE";
  const postMode = localToRemote.postMode || "FILE";

  const folderPathR2L = resolveTemplate(remoteToLocal.remoteFolder, {
    ...context,
    remoteProvider,
  });
  const fileTemplateR2L = remoteToLocal.remoteFile;

  const folderPathL2R = resolveTemplate(localToRemote.remoteFolder, {
    ...context,
    remoteProvider,
  });
  const fileTemplateL2R = localToRemote.remoteFile;

  const tasks = [];

  // === SINGLE FILE ===

  if (postMode === "SINGLE_FILE") {
    const fileName = resolveTemplate(fileTemplateR2L || fileTemplateL2R, {
      ...context,
      remoteProvider,
    });
    const filePath = `${folderPathR2L || folderPathL2R}/${fileName}`;

    let remoteMeta = null;
    try {
      remoteMeta =
        fetchMode === "FOLDER"
          ? (
              await remoteProvider.fetchFilesMetadataFromFolder(
                folderPathR2L || folderPathL2R
              )
            ).find((f) => f.path === filePath)
          : await remoteProvider.fetchFileMetadata(filePath);
    } catch (_) {}

    const findEntry = localToRemote.findEntry || [];
    const localFilter = buildFilter(findEntry, null, context);

    const newTask = {
      filePath,
      fileName,
      table: localTable,
      direction,
      localFilter,
      updatedAtRemote: remoteMeta?.lastModifiedAt,
      label: `${syncFileType}: ${fileName}`,
    };

    tasks.push(newTask);

    return tasks;
  }

  // === MULTI FILES / FOLDERS ===
  let entries = await db[localTable].toArray();
  const filterEntries = localToRemote.filterEntries || [];
  const groupEntriesBy = localToRemote.groupEntriesBy || [];

  for (const rule of filterEntries) {
    const values =
      rule.in && context[rule.in.split(".")[0]]
        ? context[rule.in.split(".")[0]].map((x) => x[rule.in.split(".")[1]])
        : [];

    if (rule.value) {
      const value = rule.value.split(".").reduce((acc, k) => acc?.[k], context);
      entries = entries.filter((e) => e[rule.key] === value);
    } else if (rule.in) {
      entries = entries.filter((e) => values.includes(e[rule.key]));
    }
  }

  if (entries.length === 0 && direction !== "PULL") return [];

  const groups = groupEntriesBy.length
    ? groupBy(entries, groupEntriesBy)
    : new Map([["ALL", entries]]);

  for (const [groupKey, group] of groups.entries()) {
    const entry = group[0];
    const localFilter = buildFilter(filterEntries, entry, context);
    const fileName = resolveTemplate(fileTemplateL2R, {
      ...context,
      ...entry,
      item: entry,
      remoteProvider,
    });
    const filePath = `${folderPathL2R}/${fileName}`;

    tasks.push({
      filePath,
      fileName,
      table: localTable,
      direction,
      localFilter,
      updatedAtRemote: undefined,
      label: `${syncFileType}: ${fileName}`,
    });
  }

  // === MULTI_FOLDERS / MULTI_SUBFOLDERS === (PULL only)
  if (direction === "PULL" && fetchMode.startsWith("MULTI")) {
    const metas = await remoteProvider.fetchFilesMetadataFromFolder(
      folderPathR2L
    );
    const filterFiles = remoteToLocal.filterFiles || [];

    const idsMap = {};
    for (const f of filterFiles) {
      const values =
        f.in && context[f.in.split(".")[0]]
          ? context[f.in.split(".")[0]].map((x) => x[f.in.split(".")[1]])
          : [];
      idsMap[f.key] = new Set(values);
    }

    for (const meta of metas) {
      let isValid = true;
      for (const filter of filterFiles) {
        const extracted = extractKeyFromTemplate(
          meta.name,
          remoteToLocal.remoteFile,
          filter.key
        );
        if (!idsMap[filter.key]?.has(extracted)) {
          isValid = false;
          break;
        }
      }

      if (isValid) {
        tasks.push({
          filePath: meta.path,
          fileName: meta.name,
          table: localTable,
          direction: "PULL",
          localFilter: {},
          updatedAtRemote: meta.lastModifiedAt,
          label: `${syncFileType}: ${meta.name}`,
        });
      }
    }
  }

  return tasks;
}
