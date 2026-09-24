import {
  batchFrameDifferences,
  batchFrameErrorDetail,
} from "./annotationBatchFrame.js";
import resolveProps from "../../annotations/utils/getAnnotationPropsFromAnnotationTemplateProps.js";
import templateProps from "../../annotations/utils/getAnnotationTemplateProps.js";

export const MAX_BATCH_ANNOTATIONS = 2000;
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
];
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
async function getTemplate(db, row, target) {
  if (!row.annotationTemplateId) return undefined;
  const t = await db.annotationTemplates.get(row.annotationTemplateId);
  if (
    !alive(t) ||
    t.listingId !== target.listingId ||
    String(t.projectId) !== String(target.projectId)
  )
    fail("TEMPLATE_CHANGED", row.annotationTemplateId);
  return t;
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

// Called inside a Dexie transaction. The receipt and all data commit together.
async function restoreReceipt(db, receipt, direction) {
  const undo = direction === "undo";
  if (receipt.kind !== "update" || Boolean(receipt.undone) === undo)
    fail("BATCH_ALREADY_RESTORED");
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
    !["query", "update", "undo"].includes(command.kind)
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
        const t = await getTemplate(db, row, target);
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
          const t = await getTemplate(db, row, target);
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
