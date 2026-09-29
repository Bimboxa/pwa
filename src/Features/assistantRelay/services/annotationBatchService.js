import {
  batchFrameDifferences,
  batchFrameErrorDetail,
} from "./annotationBatchFrame.js";
import resolveProps from "../../annotations/utils/getAnnotationPropsFromAnnotationTemplateProps.js";
import templateProps from "../../annotations/utils/getAnnotationTemplateProps.js";
import { SEGMENT_FLAG_FIELDS } from "../../annotations/utils/segmentFlags.js";

export const MAX_BATCH_ANNOTATIONS = 2000;
// Zone repair (kind "geometry"): end points moved by the relay, at most this
// many per job.
export const MAX_GEOMETRY_MOVES = 500;
const FIELDS = [
  "isExt",
  "height",
  "offsetZ",
  "strokeWidth",
  "strokeWidthUnit",
  "strokeColor",
  "fillColor",
];
const COLORS = new Set(["strokeColor", "fillColor"]);
const HEX = /^#[0-9a-f]{6}$/i;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fail = (code, detail = "") => {
  throw Object.assign(new Error(`${code}${detail ? `: ${detail}` : ""}`), {
    code,
  });
};
export const fingerprint = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]])
        )
      : v
  );
const same = (a, b) => fingerprint(a) === fingerprint(b);
const alive = (a) => a && !a.deletedAt;

export function effectiveAnnotation(row, template) {
  return resolveProps(row, templateProps(template));
}
export function matchesAnnotation(a, template, filter, meterByPx) {
  if (!alive(a)) return false;
  if (!filter.includeHidden && (a.hidden || template?.hidden)) return false;
  if (filter.ids && !filter.ids.includes(a.id)) return false;
  if (
    filter.templateIds &&
    !filter.templateIds.includes(a.annotationTemplateId)
  )
    return false;
  if (filter.types && !filter.types.includes(a.type)) return false;
  if (filter.isExt !== undefined && a.isExt !== filter.isExt) return false;
  if (filter.labelContains) {
    const text = [a.annotationLabel, a.label, template?.label]
      .filter(Boolean)
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const needle = filter.labelContains
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (!text.includes(needle)) return false;
  }
  if (filter.thicknessLessThanMeters !== undefined) {
    if (!["STRIP", "POLYLINE"].includes(a.type) || !(a.strokeWidth > 0))
      return false;
    let width;
    if (a.strokeWidthUnit === "CM") width = a.strokeWidth / 100;
    else if (a.strokeWidthUnit === "M") width = a.strokeWidth;
    else if (a.strokeWidthUnit === "PX") {
      if (!(meterByPx > 0)) fail("TARGET_NOT_CALIBRATED");
      width = a.strokeWidth * meterByPx;
    } else fail("UNKNOWN_WIDTH_UNIT", a.id);
    if (!(width < filter.thicknessLessThanMeters)) return false;
  }
  return true;
}

export function computeAnnotationPatch(row, template, operations) {
  if (
    !Array.isArray(operations) ||
    !operations.length ||
    operations.length > 20
  )
    fail("INVALID_OPERATIONS");
  const effective = effectiveAnnotation(row, template);
  const patch = {};
  const locked = new Set(template?.overrideFields ?? []);
  for (const operation of operations) {
    let values;
    if (operation.op === "set") values = operation.values;
    else if (operation.op === "increment" && operation.field === "offsetZ") {
      if (!Number.isFinite(operation.value)) fail("INVALID_VALUE");
      values = { offsetZ: (effective.offsetZ ?? 0) + operation.value };
    } else if (operation.op === "lighten" && COLORS.has(operation.field)) {
      const amount = operation.amount ?? 0.15;
      if (!Number.isFinite(amount) || amount < 0 || amount > 1)
        fail("INVALID_VALUE");
      const color = effective[operation.field];
      if (!HEX.test(color ?? "")) fail("INVALID_COLOR", row.id);
      values = {
        [operation.field]:
          "#" +
          color
            .slice(1)
            .match(/../g)
            .map((hex) => {
              const n = parseInt(hex, 16);
              return Math.round(n + (255 - n) * amount)
                .toString(16)
                .padStart(2, "0");
            })
            .join(""),
      };
    } else fail("INVALID_OPERATION");
    if (!values || !Object.keys(values).length) fail("EMPTY_PATCH");
    if (own(values, "strokeWidth") !== own(values, "strokeWidthUnit"))
      fail("WIDTH_REQUIRES_UNIT");
    for (const [field, value] of Object.entries(values)) {
      if (!FIELDS.includes(field)) fail("UNSUPPORTED_FIELD", field);
      if (locked.has(field)) fail("LOCKED_FIELD", `${row.id}.${field}`);
      if (field === "isExt" && typeof value !== "boolean")
        fail("INVALID_VALUE", field);
      if (COLORS.has(field) && !HEX.test(value ?? ""))
        fail("INVALID_COLOR", field);
      if (
        ["height", "offsetZ", "strokeWidth"].includes(field) &&
        !Number.isFinite(value)
      )
        fail("INVALID_VALUE", field);
      if (
        (field === "height" && value < 0) ||
        (field === "strokeWidth" && value <= 0)
      )
        fail("INVALID_VALUE", field);
      if (field === "strokeWidthUnit" && !["CM", "PX"].includes(value))
        fail("INVALID_VALUE", field);
      if (
        ["isExt", "strokeWidth", "strokeWidthUnit"].includes(field) &&
        !["STRIP", "POLYLINE"].includes(effective.type)
      )
        fail("INCOMPATIBLE_TYPE", row.id);
      if (
        ["height", "offsetZ"].includes(field) &&
        !["STRIP", "POLYLINE", "POLYGON"].includes(effective.type)
      )
        fail("INCOMPATIBLE_TYPE", row.id);
      patch[field] = value;
      effective[field] = value;
    }
  }
  return Object.fromEntries(
    Object.entries(patch).filter(([k, v]) => !same(row[k], v))
  );
}

const tables = (db) => [
  db.annotations,
  db.annotationTemplates,
  db.listings,
  db.baseMaps,
  db.baseMapVersions,
  db.annotationBatchReceipts,
  // Point rows of the geometry batches (absent from older test databases).
  ...(db.points ? [db.points] : []),
];
const newPointId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const finite = (p) =>
  p && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y);
const targetOf = (full) => ({
  projectId: full.snapshot.projectId,
  scopeId: full.snapshot.scopeId,
  baseMapId: full.snapshot.baseMapId,
  listingId: full.listing?.id ?? full.payload.annotationBatch.listingId,
});
async function validateTarget(db, target, context) {
  const missingTarget = [
    "projectId",
    "scopeId",
    "baseMapId",
    "listingId",
  ].filter(
    (key) =>
      target[key] === null || target[key] === undefined || target[key] === ""
  );
  if (missingTarget.length)
    fail("BATCH_TARGET_INCOMPLETE", missingTarget.join(", "));
  if (context.projectId == null || !context.scopeId)
    fail("BATCH_CONTEXT_NOT_READY");
  const changed = ["projectId", "scopeId"].filter(
    (key) => String(target[key]) !== String(context[key])
  );
  if (changed.length) fail("BATCH_CONTEXT_CHANGED", changed.join(", "));
  const listing = await db.listings.get(target.listingId);
  const baseMap = await db.baseMaps.get(target.baseMapId);
  if (
    !alive(listing) ||
    !alive(baseMap) ||
    String(listing.projectId) !== String(target.projectId) ||
    String(listing.scopeId) !== String(target.scopeId) ||
    String(baseMap.projectId) !== String(target.projectId)
  )
    fail("BATCH_TARGET_NOT_FOUND");
}
function assertRow(row, target) {
  if (
    !alive(row) ||
    String(row.projectId) !== String(target.projectId) ||
    row.baseMapId !== target.baseMapId ||
    row.listingId !== target.listingId
  )
    fail("ANNOTATION_CHANGED", row?.id);
}
// The template eye is per-scope LOCAL state (scopeVisibility slice), not a
// row field: the caller passes the hidden ids in `context`, and the template
// is returned with the derived `hidden` (matchesAnnotation reads it).
async function getTemplate(db, row, target, context) {
  if (!row.annotationTemplateId) return undefined;
  const t = await db.annotationTemplates.get(row.annotationTemplateId);
  if (
    !alive(t) ||
    t.listingId !== target.listingId ||
    String(t.projectId) !== String(target.projectId)
  )
    fail("TEMPLATE_CHANGED", row.annotationTemplateId);
  return {
    ...t,
    hidden: Boolean(context?.hiddenAnnotationTemplateIds?.includes(t.id)),
  };
}
const sample = (row, t) => {
  const a = effectiveAnnotation(row, t);
  return {
    id: row.id,
    annotationTemplateId: row.annotationTemplateId,
    label: a.label,
    templateLabel: t?.label,
    type: a.type,
    lockedFields: (t?.overrideFields ?? []).filter((f) => FIELDS.includes(f)),
    ...Object.fromEntries(
      FIELDS.filter((f) => a[f] !== undefined).map((f) => [f, a[f]])
    ),
  };
};

// Geometry batch (zone repair): every moved point is put back (undo) or
// forward (redo). A point forked by the batch keeps its own row: the fork is
// not undone, only its position. Called inside the transaction.
async function restoreGeometryReceipt(db, receipt, direction) {
  const undo = direction === "undo";
  const targets = [];
  for (const change of receipt.changes) {
    const point = await db.points.get(change.pointId);
    if (!point) fail("ANNOTATION_CHANGED", change.pointId);
    const expected = undo ? change.after : change.before;
    if (Math.hypot(point.x - expected.x, point.y - expected.y) > 1e-9)
      fail("ANNOTATION_CHANGED", change.pointId);
    const row = await db.annotations.get(change.annotationId);
    assertRow(row, receipt.target);
    targets.push([change.pointId, undo ? change.before : change.after]);
  }
  for (const [pointId, position] of targets)
    await db.points.update(pointId, { x: position.x, y: position.y });
  receipt.undone = undo;
  await db.annotationBatchReceipts.put(receipt);
  return {
    annotationIds: [...new Set(receipt.changes.map((c) => c.annotationId))],
    movedCount: receipt.changes.length,
    movedPointIds: receipt.changes.map((c) => c.pointId),
    batchKind: direction,
  };
}

// Called inside a Dexie transaction. The receipt and all data commit together.
async function restoreReceipt(db, receipt, direction) {
  const undo = direction === "undo";
  if (
    !["update", "geometry"].includes(receipt.kind) ||
    Boolean(receipt.undone) === undo
  )
    fail("BATCH_ALREADY_RESTORED");
  if (receipt.kind === "geometry")
    return restoreGeometryReceipt(db, receipt, direction);
  for (const change of receipt.changes) {
    const row = await db.annotations.get(change.id);
    assertRow(row, receipt.target);
    const t = await getTemplate(db, row, receipt.target);
    if (
      fingerprint(row) !== change.expected ||
      fingerprint(t) !== change.template
    )
      fail("ANNOTATION_CHANGED", change.id);
  }
  for (const change of receipt.changes) {
    const saved = undo ? change.before : change.after;
    const patch = Object.fromEntries(change.fields.map((k) => [k, saved[k]]));
    await db.annotations.update(change.id, patch);
    change.expected = fingerprint(await db.annotations.get(change.id));
  }
  receipt.undone = undo;
  await db.annotationBatchReceipts.put(receipt);
  return {
    annotationIds: receipt.changes.map((c) => c.id),
    updatedCount: receipt.changes.length,
    batchKind: direction,
  };
}

export async function restoreAnnotationBatch(db, jobId, direction, context) {
  return db.transaction("rw", tables(db), async (tx) => {
    tx.annotationBatch = true;
    const receipt = await db.annotationBatchReceipts.get(jobId);
    if (!receipt) fail("BATCH_RECEIPT_MISSING");
    await validateTarget(db, receipt.target, context);
    return restoreReceipt(db, receipt, direction);
  });
}

export async function applyAnnotationBatch(db, full, context, readFrame) {
  const command = full.payload?.annotationBatch;
  if (
    command?.version !== 1 ||
    !["query", "update", "geometry", "undo"].includes(command.kind)
  )
    fail("INVALID_BATCH");
  return db.transaction("rw", tables(db), async (tx) => {
    tx.annotationBatch = true; // Keep per-row undo hooks from splitting the batch.
    const previous = await db.annotationBatchReceipts.get(full.jobId);
    if (previous) {
      if (previous.command !== fingerprint(command))
        fail("JOB_PAYLOAD_CHANGED");
      await validateTarget(db, previous.target, context);
      return { ...previous.result, replayed: true };
    }
    const target = targetOf(full);
    await validateTarget(db, target, context);
    const frame = await readFrame();
    if (batchFrameDifferences(command.frame, frame).length) {
      fail("BATCH_FRAME_CHANGED", batchFrameErrorDetail(command.frame, frame));
    }
    // Keep the published calibration throughout the command. Local reads only
    // validate it; neither selection nor the model recomputes the scale.
    const publishedFrame = command.frame;
    const receipt = {
      jobId: full.jobId,
      kind: command.kind,
      target,
      command: fingerprint(command),
      createdAt: new Date().toISOString(),
    };
    if (command.kind === "query") {
      const filter = command.filter ?? {};
      const rows = await db.annotations
        .where("listingId")
        .equals(target.listingId)
        .toArray();
      const selected = [];
      const samples = [];
      for (const row of rows) {
        if (!alive(row) || row.baseMapId !== target.baseMapId) continue;
        if (!filter.includeHidden && row.hidden) continue;
        assertRow(row, target);
        const t = await getTemplate(db, row, target, context);
        if (
          !matchesAnnotation(
            effectiveAnnotation(row, t),
            t,
            filter,
            publishedFrame.meterByPx
          )
        )
          continue;
        selected.push({
          id: row.id,
          expected: fingerprint(row),
          template: fingerprint(t),
        });
        if (samples.length < 20) samples.push(sample(row, t));
        if (selected.length > MAX_BATCH_ANNOTATIONS)
          fail(
            "BATCH_TOO_LARGE",
            "Narrow the selection; no truncation was applied"
          );
      }
      receipt.selected = selected;
      receipt.frame = publishedFrame;
      receipt.result = {
        selectionId: full.jobId,
        count: selected.length,
        samples,
        sampleLimit: 20,
        batchKind: "query",
        ...target,
      };
    } else if (command.kind === "update") {
      if (
        !Array.isArray(command.groups) ||
        !command.groups.length ||
        command.groups.length > 20
      )
        fail("INVALID_BATCH");
      const changes = [];
      const usedIds = new Set();
      const selections = [];
      for (const group of command.groups) {
        const selection = await db.annotationBatchReceipts.get(
          group.selectionId
        );
        if (
          selection?.kind !== "query" ||
          !same(selection.target, target) ||
          batchFrameDifferences(selection.frame, publishedFrame).length > 0
        )
          fail("SELECTION_NOT_FOUND", group.selectionId);
        if (selection.consumedBy)
          fail("SELECTION_ALREADY_USED", group.selectionId);
        selections.push(selection);
        for (const entry of selection.selected) {
          if (usedIds.has(entry.id)) fail("OVERLAPPING_SELECTIONS", entry.id);
          usedIds.add(entry.id);
          if (usedIds.size > MAX_BATCH_ANNOTATIONS) fail("BATCH_TOO_LARGE");
          const row = await db.annotations.get(entry.id);
          assertRow(row, target);
          const t = await getTemplate(db, row, target, context);
          if (
            fingerprint(row) !== entry.expected ||
            fingerprint(t) !== entry.template
          )
            fail("ANNOTATION_CHANGED", entry.id);
          const patch = computeAnnotationPatch(row, t, group.operations);
          if (Object.keys(patch).length)
            changes.push({
              id: row.id,
              fields: Object.keys(patch),
              before: Object.fromEntries(
                Object.keys(patch)
                  .filter((k) => own(row, k))
                  .map((k) => [k, row[k]])
              ),
              after: patch,
              template: entry.template,
            });
        }
      }
      // All validation completes before the first annotation write.
      for (const change of changes) {
        await db.annotations.update(change.id, change.after);
        change.expected = fingerprint(await db.annotations.get(change.id));
      }
      for (const selection of selections)
        await db.annotationBatchReceipts.update(selection.jobId, {
          consumedBy: full.jobId,
        });
      receipt.changes = changes;
      receipt.result = {
        annotationIds: changes.map((c) => c.id),
        updatedCount: changes.length,
        matchedCount: usedIds.size,
        unchangedCount: usedIds.size - changes.length,
        batchKind: "update",
      };
    } else if (command.kind === "geometry") {
      // Zone repair: the relay read every point (`from`, reference pixels of
      // the published frame) and asks to move it to `to`. A point that moved
      // since, a rotated annotation or an unknown reference refuses the whole
      // batch. A vertex shared with another annotation is forked first, so
      // the neighbour keeps its own end.
      const moves = command.moves;
      if (
        !Array.isArray(moves) ||
        !moves.length ||
        moves.length > MAX_GEOMETRY_MOVES ||
        command.coordinateSpace !== "reference_pixels"
      )
        fail("INVALID_BATCH");
      const width = publishedFrame?.refSize?.width;
      const height = publishedFrame?.refSize?.height;
      if (!(width > 0) || !(height > 0)) fail("BATCH_FRAME_CHANGED", "refSize");
      // One millimetre of the plan (the relay rounds what it reads to 1 mm).
      const tolerance =
        publishedFrame.meterByPx > 0 ? 0.001 / publishedFrame.meterByPx : 0.01;
      const refCount = new Map();
      await db.annotations
        .filter((a) => alive(a) && a.baseMapId === target.baseMapId)
        .each((a) => {
          const ids = new Set();
          a.points?.forEach((p) => p?.id && ids.add(p.id));
          a.cuts?.forEach((cut) =>
            cut?.points?.forEach((p) => p?.id && ids.add(p.id))
          );
          ids.forEach((id) => refCount.set(id, (refCount.get(id) || 0) + 1));
        });
      const changes = [];
      const seen = new Set();
      for (const move of moves) {
        if (
          !move ||
          typeof move.annotationId !== "string" ||
          typeof move.pointId !== "string" ||
          !finite(move.from) ||
          !finite(move.to)
        )
          fail("INVALID_BATCH", "move");
        if (seen.has(move.pointId))
          fail("OVERLAPPING_SELECTIONS", move.pointId);
        seen.add(move.pointId);
        const row = await db.annotations.get(move.annotationId);
        assertRow(row, target);
        if (row.rotation || row.rotationCenter)
          fail("ANNOTATION_ROTATED", row.id);
        if (!row.points?.some((p) => p?.id === move.pointId))
          fail("ANNOTATION_CHANGED", `${row.id}.${move.pointId}`);
        const point = await db.points.get(move.pointId);
        if (!point) fail("ANNOTATION_CHANGED", move.pointId);
        const current = { x: point.x * width, y: point.y * height };
        if (
          Math.hypot(current.x - move.from.x, current.y - move.from.y) >
          tolerance
        )
          fail("ANNOTATION_CHANGED", move.pointId);
        changes.push({
          annotationId: row.id,
          pointId: move.pointId,
          shared: (refCount.get(move.pointId) || 0) > 1,
          before: { x: point.x, y: point.y },
          after: { x: move.to.x / width, y: move.to.y / height },
          source: point,
        });
      }
      // All validation completes before the first write.
      for (const change of changes) {
        if (change.shared) {
          const forked = newPointId();
          await db.points.add({
            ...change.source,
            id: forked,
            x: change.after.x,
            y: change.after.y,
          });
          const row = await db.annotations.get(change.annotationId);
          const patch = {
            points: row.points.map((p) =>
              p?.id === change.pointId ? { ...p, id: forked } : p
            ),
          };
          for (const { idField } of SEGMENT_FLAG_FIELDS)
            if (Array.isArray(row[idField]))
              patch[idField] = row[idField].map((id) =>
                id === change.pointId ? forked : id
              );
          await db.annotations.update(row.id, patch);
          change.forkedFrom = change.pointId;
          change.pointId = forked;
        } else {
          await db.points.update(change.pointId, {
            x: change.after.x,
            y: change.after.y,
          });
        }
        delete change.shared;
        delete change.source;
      }
      receipt.changes = changes;
      receipt.result = {
        annotationIds: [...new Set(changes.map((c) => c.annotationId))],
        movedCount: changes.length,
        movedPointIds: changes.map((c) => c.pointId),
        batchKind: "geometry",
      };
    } else {
      const original = await db.annotationBatchReceipts.get(command.undoOf);
      if (!original || !same(original.target, target))
        fail("BATCH_RECEIPT_MISSING");
      receipt.result = await restoreReceipt(db, original, "undo");
    }
    await db.annotationBatchReceipts.put(receipt);
    return receipt.result;
  });
}
