// Group new bundles and legacy per-event captures without losing raw JSON.
export function groupDetectionDebug(records = []) {
  const groups = new Map();
  for (const record of records) {
    const key = JSON.stringify([
      record.archiveKey,
      record.messageId ?? record.id,
    ]);
    let group = groups.get(key);
    if (!group) {
      group = {
        id: `diagnostic:${record.messageId ?? record.id}`,
        messageId: record.messageId,
        archiveKey: record.archiveKey,
        listingId: record.listingId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt ?? record.createdAt,
        artifacts: [],
      };
      groups.set(key, group);
    }
    group.createdAt = Math.min(group.createdAt, record.createdAt);
    group.updatedAt = Math.max(
      group.updatedAt,
      record.updatedAt ?? record.createdAt
    );
    if (record.status) group.status = record.status;
    if (record.saveError) group.saveError = record.saveError;
    const entries =
      record.artifacts ??
      (record.artifact
        ? [{ createdAt: record.createdAt, ...record.artifact }]
        : []);
    for (const entry of entries) {
      const index = group.artifacts.findIndex(
        (a) => a.id === entry.id && a.stage === entry.stage
      );
      if (index < 0) group.artifacts.push(entry);
      else group.artifacts[index] = entry;
    }
  }
  return [...groups.values()].map((group) => ({
    ...group,
    artifacts: group.artifacts.sort((a, b) => a.createdAt - b.createdAt),
  }));
}

export function serializeDetectionDebug(record) {
  const { messageId, listingId, createdAt, updatedAt, status, artifacts } =
    record;
  return JSON.stringify(
    {
      version: 2,
      messageId,
      listingId,
      createdAt,
      updatedAt,
      status,
      artifacts,
    },
    null,
    2
  );
}
