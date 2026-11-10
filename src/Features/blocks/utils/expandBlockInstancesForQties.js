// Quantities of the block instances.
//
// An instance draws its block and carries no geometry, so it has no quantity
// of its own: it counts as ONE COPY OF EACH MEMBER of its block. This util
// turns the member rows into one VIRTUAL row per (instance, member):
//
//   N instances of a block × the block's quantities, per annotation template
//
// Input rows (resolved annotations, quantities already computed):
//   - a member row may carry `_blockQtyInstances`: the instances of its block
//     to count — [{id, baseMapId, layerId, bbox}] (bbox normalized on the
//     instance's host base map);
//   - `_blockQtyOnly: true` marks a member that is in the list ONLY to feed
//     its instances (it lives on a blocks base map, which the query does not
//     show): it is dropped from the output.
//
// A virtual row is the member (template, style, `qties`) re-homed on the
// instance's host:
//   id: `${instanceId}::${memberId}`     (never a db id — read-only row)
//   baseMapId / baseMapName / layerId: the instance's
//   _blockInstanceId, _blockMemberId, isBlockInstanceMember: true
//   _blockInstanceAnchorX / Y: the instance insertion point, host pixels
//     (scalars: getAnnotationBBox uses them for the view-box filters)
// Its `points` stay in the pixel frame of the BLOCKS base map: a virtual row
// is a quantity carrier, never something to draw.
//
// hostsById: {[baseMapId]: {name, width, height}}
//
// Never mutates the input rows. Pure: node-testable.
export const BLOCK_VIRTUAL_ID_SEPARATOR = "::";

export function getBlockVirtualRowId(instanceId, memberId) {
  return `${instanceId}${BLOCK_VIRTUAL_ID_SEPARATOR}${memberId}`;
}

export default function expandBlockInstancesForQties(rows, hostsById = {}) {
  if (!Array.isArray(rows)) return rows;
  if (!rows.some((r) => r?._blockQtyInstances || r?._blockQtyOnly)) return rows;

  const result = [];
  const virtualRows = [];
  for (const row of rows) {
    const instances = row?._blockQtyInstances;
    if (!instances && !row?._blockQtyOnly) {
      result.push(row);
      continue;
    }

    // a copy without the stage-A tags (the input row is never mutated)
    const member = { ...row };
    delete member._blockQtyInstances;
    delete member._blockQtyOnly;
    if (!row._blockQtyOnly) result.push(member);

    for (const instance of instances ?? []) {
      if (!instance?.id) continue;
      const host = hostsById[instance.baseMapId];
      const anchorX =
        host?.width > 0 && Number.isFinite(instance.bbox?.x)
          ? (instance.bbox.x + (Number(instance.bbox.width) || 0) / 2) *
            host.width
          : null;
      const anchorY =
        host?.height > 0 && Number.isFinite(instance.bbox?.y)
          ? (instance.bbox.y + (Number(instance.bbox.height) || 0) / 2) *
            host.height
          : null;
      virtualRows.push({
        ...member,
        id: getBlockVirtualRowId(instance.id, member.id),
        baseMapId: instance.baseMapId,
        baseMapName: host?.name ?? member.baseMapName,
        layerId: instance.layerId ?? null,
        isBlockInstanceMember: true,
        _blockInstanceId: instance.id,
        _blockMemberId: member.id,
        _blockInstanceAnchorX: anchorX,
        _blockInstanceAnchorY: anchorY,
      });
    }
  }
  return [...result, ...virtualRows];
}
