// Merge rule (loadKrtoZip parity): write a row only when absent locally or
// when the remote row is newer than the local updatedAt. Tombstones
// participate (reads are NOT filtered by the soft-delete middleware, so
// local tombstones are part of the compared index).
export default function isRemoteNewer(remoteUpdatedAtMs, localRow) {
  if (!localRow) return true;
  const localTs =
    Date.parse(localRow.updatedAt ?? localRow.createdAt ?? "") || 0;
  return (remoteUpdatedAtMs ?? 0) > localTs;
}
