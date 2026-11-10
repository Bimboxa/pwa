import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";
import getAnnotationBBox from "Features/annotations/utils/getAnnotationBbox";
import getBaseMapImageSizeFromRecord from "Features/baseMaps/utils/getBaseMapImageSizeFromRecord";
import buildPasteClipboard from "Features/mapEditor/utils/buildPasteClipboard";
import pasteAnnotationService from "Features/mapEditor/services/pasteAnnotationService";

import createBlocksBaseMapService from "./createBlocksBaseMapService";
import createBlockInstanceService from "./createBlockInstanceService";
import findFreeSlotOnBlocksBaseMap from "../utils/findFreeSlotOnBlocksBaseMap";
import getBlockLinkPlacement from "../utils/getBlockLinkPlacement";
import getBlockLinkRefusal, {
  getBlockLinkRefusalMessage,
} from "../utils/getBlockLinkRefusal";
import { getBlockInstanceAnchorPx } from "../utils/blockInstanceGeometry";

// Clearance (meters) around a block on its blocks base map.
const SLOT_MARGIN_M = 0.5;

const RELATIONS_REFUSAL_S =
  "Une annotation liée à une soustraction, à un maillage ou portant de la peinture ne peut pas être liée à un bloc.";
const NO_SCALE_S =
  "Le fond de plan doit avoir une échelle pour lier des annotations à un bloc.";

async function readBaseMapFrame(baseMapId) {
  const record = baseMapId ? await db.baseMaps.get(baseMapId) : null;
  if (!record || record.deletedAt) return null;
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(baseMapId)
    .toArray();
  const imageSize = getBaseMapImageSizeFromRecord(record, versions);
  if (!imageSize?.width || !imageSize?.height) return null;
  return { record, imageSize, meterByPx: Number(record.meterByPx) || 0 };
}

// One pixel box per annotation already drawn on a blocks base map.
async function getOccupiedBoxesPx(baseMapId, imageSize) {
  const rows = (
    await db.annotations.where("baseMapId").equals(baseMapId).toArray()
  ).filter((a) => !a.deletedAt);
  if (rows.length === 0) return [];
  const pointIds = collectReferencedPointIds(rows);
  const pointById = new Map();
  (await db.points.bulkGet([...pointIds])).forEach((p) => {
    if (p && !p.deletedAt) pointById.set(p.id, p);
  });
  const boxes = [];
  rows.forEach((row) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    collectReferencedPointIds([row]).forEach((id) => {
      const p = pointById.get(id);
      if (!p) return;
      const x = p.x * imageSize.width;
      const y = p.y * imageSize.height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    if (minX !== Infinity)
      boxes.push({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  });
  return boxes;
}

// Size (host pixels) of the selection.
function getSelectionSizePx(annotations) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  annotations.forEach((a) => {
    const bbox = getAnnotationBBox(a);
    if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return;
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + (bbox.width || 0));
    maxY = Math.max(maxY, bbox.y + (bbox.height || 0));
  });
  if (minX === Infinity) return { width: 0, height: 0 };
  return { width: maxX - minX, height: maxY - minY };
}

// « Lier à un bloc » on a REGULAR base map: the selected annotations are
// MOVED to the blocks base map (same ids, fresh points), linked to the block,
// and replaced in place by an instance of the block — nothing moves on
// screen. See getBlockLinkPlacement for the three placement cases.
//
//   annotations: the selection, RESOLVED in pixels (useAnnotationsV2), all on
//     the same regular base map
//   blockId: an existing block, or null with `newBlockLabel` to create one
//
// One transaction + one undo step (the blocks base map, when one has to be
// created, is written before: db.baseMaps is not undoable).
//
// Returns {
//   error: string | null,
//   blockId, movedIds, instanceId (created instance, or null),
//   usedReferenceInstance (members expressed against an existing instance),
//   createdBlocksBaseMap (a base map was created)
// }
export default async function linkAnnotationsToBlockService({
  annotations,
  blockId,
  newBlockLabel,
  projectId,
  scopeId,
  activeLayerId = null,
}) {
  const fail = (error) => ({ error, movedIds: [] });

  const refusal = getBlockLinkRefusal(annotations);
  if (refusal) return fail(getBlockLinkRefusalMessage(refusal));
  if (!projectId || !scopeId) return fail("Sélectionnez un Krto.");

  const ids = annotations.map((a) => a.id);

  // --- host base map ---

  const host = await readBaseMapFrame(annotations[0].baseMapId);
  if (!host || host.record.isBlocksBaseMap) return fail(NO_SCALE_S);
  if (!(host.meterByPx > 0)) return fail(NO_SCALE_S);

  // --- relations the move would leave dangling across base maps ---

  const [subtractionsFrom, subtractionsTo, meshRels, paints] =
    await Promise.all([
      db.relAnnotationSubtractions
        .where("sourceAnnotationId")
        .anyOf(ids)
        .toArray(),
      db.relAnnotationSubtractions
        .where("targetAnnotationId")
        .anyOf(ids)
        .toArray(),
      db.relAnnotationMeshCells.where("parentAnnotationId").anyOf(ids).toArray(),
      db.meshPaints.where("hostAnnotationId").anyOf(ids).toArray(),
    ]);
  const hasLiveRelation = [
    subtractionsFrom,
    subtractionsTo,
    meshRels,
    paints,
  ].some((rows) => rows.some((r) => !r.deletedAt));
  if (hasLiveRelation) return fail(RELATIONS_REFUSAL_S);

  // --- snapshot of the selection ---

  const pasteClipboard = buildPasteClipboard(annotations, host.meterByPx);
  if (!pasteClipboard) return fail(getBlockLinkRefusalMessage("EMPTY"));
  const sourceCenterPx = pasteClipboard.sourceCenter;

  // --- block + its frame ---

  const block = blockId ? await db.blocks.get(blockId) : null;
  if (blockId && (!block || block.deletedAt)) return fail("Bloc introuvable.");

  let blocksBaseMap = block?.origin
    ? await readBaseMapFrame(block.origin.baseMapId)
    : null;
  let originPx = null;
  let slotCenterPx = null;
  let referenceInstance = null;
  let createdBlocksBaseMap = false;

  if (blocksBaseMap?.meterByPx > 0) {
    originPx = {
      x: block.origin.x * blocksBaseMap.imageSize.width,
      y: block.origin.y * blocksBaseMap.imageSize.height,
    };
    // nearest instance of this block on the host
    const instances = (
      await db.annotations.where("instanceOfBlockId").equals(block.id).toArray()
    ).filter((a) => !a.deletedAt && a.baseMapId === host.record.id);
    let bestDistance = Infinity;
    instances.forEach((row) => {
      const anchorPx = getBlockInstanceAnchorPx({
        bbox: {
          x: (row.bbox?.x ?? NaN) * host.imageSize.width,
          y: (row.bbox?.y ?? NaN) * host.imageSize.height,
          width: 0,
          height: 0,
        },
      });
      if (!anchorPx) return;
      const distance = Math.hypot(
        anchorPx.x - sourceCenterPx.x,
        anchorPx.y - sourceCenterPx.y
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        referenceInstance = {
          anchorPx,
          rotation: row.rotation,
          offsetZ: row.offsetZ,
        };
      }
    });
  } else {
    // no origin yet: a free slot on a blocks base map
    blocksBaseMap = null;
    const sizeHostPx = getSelectionSizePx(annotations);
    const candidates = (
      await db.baseMaps.where("projectId").equals(projectId).toArray()
    )
      .filter((r) => r.isBlocksBaseMap && !r.deletedAt)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const findSlot = async (frame) => {
      const scale = host.meterByPx / frame.meterByPx;
      const margin = SLOT_MARGIN_M / frame.meterByPx;
      return findFreeSlotOnBlocksBaseMap({
        occupiedBoxes: await getOccupiedBoxesPx(
          frame.record.id,
          frame.imageSize
        ),
        size: {
          width: sizeHostPx.width * scale,
          height: sizeHostPx.height * scale,
        },
        pageSize: frame.imageSize,
        margin,
        step: margin / 2,
      });
    };

    for (const candidate of candidates) {
      const frame = await readBaseMapFrame(candidate.id);
      if (!(frame?.meterByPx > 0)) continue;
      const slot = await findSlot(frame);
      if (slot) {
        blocksBaseMap = frame;
        slotCenterPx = slot;
        break;
      }
    }
    if (!blocksBaseMap) {
      const record = await createBlocksBaseMapService({ projectId });
      createdBlocksBaseMap = true;
      blocksBaseMap = await readBaseMapFrame(record.id);
      // an oversized block still lands on the page center
      slotCenterPx = (await findSlot(blocksBaseMap)) ?? {
        x: blocksBaseMap.imageSize.width / 2,
        y: blocksBaseMap.imageSize.height / 2,
      };
    }
  }

  const placement = getBlockLinkPlacement({
    sourceCenterPx,
    hostMeterByPx: host.meterByPx,
    blockMeterByPx: blocksBaseMap.meterByPx,
    originPx,
    slotCenterPx,
    referenceInstance,
  });
  if (!placement) return fail(NO_SCALE_S);

  // --- write: one transaction, one undo step ---

  const targetBlockId = block?.id ?? nanoid();
  const origin = {
    baseMapId: blocksBaseMap.record.id,
    x: placement.originPx.x / blocksBaseMap.imageSize.width,
    y: placement.originPx.y / blocksBaseMap.imageSize.height,
    z: block?.origin?.z ?? 0,
  };
  const targetBaseMap = {
    id: blocksBaseMap.record.id,
    getImageSize: () => blocksBaseMap.imageSize,
  };

  let movedIds = [];
  let instanceId = null;

  await withUndoGroup(() =>
    db.transaction(
      "rw",
      [
        db.annotations,
        db.points,
        db.files,
        db.blocks,
        db.baseMaps,
        db.baseMapVersions,
        db.relAnnotationMappingCategory,
        db.relAnnotationOpenings,
      ],
      async () => {
        if (!block) {
          await db.blocks.add({
            id: targetBlockId,
            projectId,
            scopeId,
            label: newBlockLabel?.trim() || "Bloc",
            origin,
          });
        } else if (placement.setsOrigin) {
          await db.blocks.update(targetBlockId, { origin });
        }

        const moved = await pasteAnnotationService({
          pasteClipboard,
          pasteTransform: { rotationDeg: placement.rotationDeg, flipX: false },
          targetCenter: placement.targetCenterPx,
          baseMap: targetBaseMap,
          targetMeterByPx: blocksBaseMap.meterByPx,
          keepSourceIds: true,
        });
        movedIds = moved.map((a) => a.id);

        await Promise.all(
          moved.map((a) =>
            db.annotations.update(a.id, {
              blockId: targetBlockId,
              ...(placement.offsetZDelta
                ? {
                    offsetZ:
                      (Number(a.offsetZ) || 0) + placement.offsetZDelta,
                  }
                : {}),
            })
          )
        );

        if (placement.instance && movedIds.length > 0) {
          const instance = await createBlockInstanceService({
            blockId: targetBlockId,
            baseMapId: host.record.id,
            anchor: {
              x: placement.instance.anchorPx.x / host.imageSize.width,
              y: placement.instance.anchorPx.y / host.imageSize.height,
            },
            projectId,
            scopeId,
            rotation: placement.instance.rotation,
            layerId: activeLayerId,
          });
          instanceId = instance?.id ?? null;
        }
      }
    )
  );

  return {
    error: null,
    blockId: targetBlockId,
    movedIds,
    instanceId,
    usedReferenceInstance: !placement.instance,
    createdBlocksBaseMap,
  };
}
