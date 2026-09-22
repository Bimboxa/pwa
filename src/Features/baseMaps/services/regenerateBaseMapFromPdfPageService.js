import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";
import { nanoid } from "@reduxjs/toolkit";

import db, { withSystemWrite } from "App/db/db";
import { withoutUndo, clearUndo } from "App/db/undoManager";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { notifyLocalChange } from "Features/remoteScopeConfigurations/services/localChangeTracker";

import { PDFJS_DOC_PARAMS } from "Features/pdf/utils/pdfjsParams";
import { renderPageToPngBlob } from "Features/pdf/utils/pdfToPngAsync";
import { resolveDetailResource } from "./detailBaseMapUtils";
import { prepareVersionImageReplacement } from "./replaceVersionImageService";
import buildFrameTransform, {
  normalizeBbox,
  normalizeRotation,
} from "Features/baseMaps/utils/baseMapFrameTransform";
import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";
import scaleAnnotationPxFields from "Features/annotations/utils/scaleAnnotationPxFields";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import baseMapLocalToWorld from "Features/baseMaps/js/baseMapLocalToWorld";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const METER_PER_INCH = 0.0254;
const POINTS_PER_INCH = 72;
const IDENTITY = { x: 0, y: 0, rotation: 0, scale: 1 };

// Finds the version holding the PDF render: pinned by createdFrom.versionId,
// legacy fallback = the version sharing the record's (legacy) image file.
export function findPdfVersion(record, versions) {
  const live = (versions ?? []).filter((v) => !v.deletedAt);
  const pinned = live.find((v) => v.id === record?.createdFrom?.versionId);
  if (pinned) return pinned;
  const legacyFileName = record?.image?.fileName;
  if (legacyFileName) {
    const byFile = live.find((v) => v.image?.fileName === legacyFileName);
    if (byFile) return byFile;
  }
  return null;
}

function isIdentityTransform(t) {
  if (!t) return true;
  return (
    Math.abs(t.x ?? 0) < 1e-6 &&
    Math.abs(t.y ?? 0) < 1e-6 &&
    Math.abs(t.rotation ?? 0) < 1e-6 &&
    Math.abs((t.scale ?? 1) - 1) < 1e-6
  );
}

// Why a base map cannot be regenerated (null = eligible). Pure on the given
// rows so the UI can reuse it (menu item tooltip).
export function getRegenerateIneligibilityReason(record, versions) {
  if (!record) return "Fond de plan introuvable.";
  if (record.isDetail) return "Les fonds de plan de détail sont régénérés automatiquement.";
  const createdFrom = record.createdFrom;
  if (createdFrom?.type !== "PDF_PAGE" || !createdFrom.resourceId) {
    return "Ce fond de plan n'a pas été créé depuis un PDF conservé.";
  }
  const version = findPdfVersion(record, versions);
  if (!version) return "La version issue du PDF est introuvable.";
  if (!isIdentityTransform(version.transform)) {
    return "La version issue du PDF a été déplacée : replacez-la à l'origine avant de régénérer.";
  }
  const size = version.image?.imageSize;
  if (
    record.refWidth &&
    record.refHeight &&
    size &&
    (size.width !== record.refWidth || size.height !== record.refHeight)
  ) {
    return "L'image d'origine a été remplacée manuellement : la provenance PDF n'est plus valable.";
  }
  return null;
}

const isPt = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

export default async function regenerateBaseMapFromPdfPageService({
  baseMapId,
  bboxInRatio,
  dpi,
  dispatch,
  onProgress,
}) {
  const record = await db.baseMaps.get(baseMapId);
  const versions = (
    await db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray()
  ).filter((v) => !v.deletedAt);

  const reason = getRegenerateIneligibilityReason(record, versions);
  if (reason) throw new Error(reason);

  const createdFrom = record.createdFrom;
  const pdfVersion = findPdfVersion(record, versions);
  const rotation = normalizeRotation(createdFrom.rotation);
  const oldBbox = normalizeBbox(createdFrom.bboxInRatio);
  const newBbox = normalizeBbox(bboxInRatio);
  const oldSize = {
    width: record.refWidth ?? pdfVersion.image?.imageSize?.width,
    height: record.refHeight ?? pdfVersion.image?.imageSize?.height,
  };
  if (!oldSize.width || !oldSize.height) {
    throw new Error("Taille de référence du fond de plan inconnue.");
  }

  // --- source PDF ---
  const resource = await resolveDetailResource({
    createdFrom,
    projectId: record.projectId,
  });
  if (!resource) throw new Error("PDF source absent : rechargez-le depuis le panneau Ressources.");
  const fileRecord = await db.files.get(resource.fileName);
  if (!fileRecord?.fileArrayBuffer) {
    throw new Error("PDF source absent : rechargez-le depuis le panneau Ressources.");
  }

  onProgress?.("render");
  const loadingTask = getDocument({
    data: fileRecord.fileArrayBuffer.slice(0),
    ...PDFJS_DOC_PARAMS,
  });
  const pdfDocument = await loadingTask.promise;
  let rendered;
  let viewportOld;
  let viewport1;
  let newDpi;
  try {
    const pdfPage = await pdfDocument.getPage(createdFrom.pageNumber ?? 1);
    viewport1 = pdfPage.getViewport({ scale: 1, rotation });
    // Legacy rows may lack the dpi: derive it from the reference width.
    let oldDpi = Number(createdFrom.dpi);
    if (!Number.isFinite(oldDpi) || oldDpi <= 0) {
      const cropW = (oldBbox.x2 - oldBbox.x1) * viewport1.width;
      oldDpi = (POINTS_PER_INCH * oldSize.width) / cropW;
    }
    newDpi = Number(dpi) > 0 ? Number(dpi) : oldDpi;
    viewportOld = pdfPage.getViewport({ scale: oldDpi / 72, rotation });
    rendered = await renderPageToPngBlob({
      pdfPage,
      resolution: newDpi,
      bboxInRatio: newBbox,
      rotate: rotation,
    });
    rendered.k = newDpi / oldDpi;
  } finally {
    pdfDocument.destroy();
  }

  const newSize = { width: rendered.width, height: rendered.height };
  const T = buildFrameTransform({
    oldBbox,
    newBbox,
    viewportSize: { width: viewportOld.width, height: viewportOld.height },
    k: rendered.k,
    oldSize,
    newSize,
  });
  const { N, PX, S, NW, NH, k } = T;
  const longRatio =
    Math.max(oldSize.width, oldSize.height) /
    Math.max(newSize.width, newSize.height);

  // --- new image ---
  const imageFile = new File([rendered.blob], `${record.name}.png`, {
    type: "image/png",
  });
  const { fileRecord: newFileRecord, image: newImage } =
    await prepareVersionImageReplacement({
      baseMapId,
      record,
      file: imageFile,
      imageSize: newSize,
    });

  onProgress?.("write");

  // --- collect rows (reads outside the transaction keep it short) ---
  const annotations = await db.annotations
    .where("baseMapId")
    .equals(baseMapId)
    .toArray();
  const annotationIds = new Set(annotations.map((a) => a.id));
  const referencedIds = collectReferencedPointIds(annotations);
  const pointsByBaseMap = await db.points
    .where("baseMapId")
    .equals(baseMapId)
    .toArray();
  const pointIdSet = new Set(pointsByBaseMap.map((p) => p.id));
  const missingIds = [...referencedIds].filter((id) => !pointIdSet.has(id));
  const extraPoints = (await db.points.bulkGet(missingIds)).filter(Boolean);
  const candidatePoints = [...pointsByBaseMap, ...extraPoints];

  // Defensive: a point referenced by an annotation of ANOTHER base map is not
  // moved but forked for this base map's annotations.
  const foreignAnnotations = missingIds.length
    ? (
        await db.annotations
          .filter(
            (a) =>
              !annotationIds.has(a.id) &&
              a.baseMapId &&
              a.baseMapId !== baseMapId
          )
          .toArray()
      ).filter((a) => !a.deletedAt)
    : [];
  const foreignReferenced = collectReferencedPointIds(foreignAnnotations);
  const sharedIds = new Set(
    candidatePoints.map((p) => p.id).filter((id) => foreignReferenced.has(id))
  );

  const forkedIdMap = {}; // shared old id -> new id (for this base map)
  const pointsToPut = [];
  for (const p of candidatePoints) {
    const np = N({ x: p.x ?? 0, y: p.y ?? 0 });
    if (sharedIds.has(p.id)) {
      const newId = nanoid();
      forkedIdMap[p.id] = newId;
      const fork = { ...p, id: newId, x: np.x, y: np.y, baseMapId };
      delete fork.deletedAt;
      delete fork.deletedByUserIdMaster;
      pointsToPut.push(fork);
    } else {
      pointsToPut.push({ ...p, x: np.x, y: np.y });
    }
  }
  const remapRefs = (arr, key) =>
    Array.isArray(arr)
      ? arr.map((r) =>
          r && forkedIdMap[r[key]] ? { ...r, [key]: forkedIdMap[r[key]] } : r
        )
      : arr;

  const annotationsToPut = [];
  for (const a of annotations) {
    const next = structuredClone(a);
    let changed = false;

    // forked shared points
    if (Object.keys(forkedIdMap).length > 0) {
      if (next.point?.id && forkedIdMap[next.point.id]) {
        next.point = { ...next.point, id: forkedIdMap[next.point.id] };
        changed = true;
      }
      for (const key of ["points", "innerPoints"]) {
        const r = remapRefs(next[key], "id");
        if (r !== next[key]) {
          next[key] = r;
          changed = true;
        }
      }
      if (Array.isArray(next.cuts)) {
        next.cuts = next.cuts.map((c) => ({ ...c, points: remapRefs(c?.points, "id") }));
        changed = true;
      }
      for (const key of ["guideLines", "isoHeightLines", "profileLines"]) {
        if (Array.isArray(next[key])) {
          next[key] = next[key].map((l) => ({
            ...l,
            points: remapRefs(l?.points, "pointId"),
          }));
          changed = true;
        }
      }
    }

    // legacy inline normalized geometry (used only when no db.points row)
    const mapInline = (arr) =>
      Array.isArray(arr)
        ? arr.map((p) => (isPt(p) ? { ...p, ...N(p) } : p))
        : arr;
    if (Array.isArray(next.points) && next.points.some(isPt)) {
      next.points = mapInline(next.points);
      changed = true;
    }
    if (Array.isArray(next.cuts)) {
      next.cuts = next.cuts.map((c) =>
        Array.isArray(c?.points) && c.points.some(isPt)
          ? { ...c, points: mapInline(c.points) }
          : c
      );
    }
    if (Number.isFinite(next.x) && Number.isFinite(next.y)) {
      const np = N({ x: next.x, y: next.y });
      next.x = np.x;
      next.y = np.y;
      changed = true;
    }

    // normalized inline points
    for (const key of ["labelPoint", "targetPoint", "elbowPoint", "rotationCenter"]) {
      if (isPt(next[key])) {
        next[key] = { ...next[key], ...N(next[key]) };
        changed = true;
      }
    }
    if (next.bbox && isPt(next.bbox)) {
      next.bbox = {
        ...next.bbox,
        ...N(next.bbox),
        ...(Number.isFinite(next.bbox.width) ? { width: NW(next.bbox.width) } : {}),
        ...(Number.isFinite(next.bbox.height) ? { height: NH(next.bbox.height) } : {}),
      };
      changed = true;
    }
    // POLYGON mesh lines are normalized; POLYLINE ones are {u, z} (invariant)
    const mapMeshLines = (lines) =>
      Array.isArray(lines)
        ? lines.map((l) => ({
            ...l,
            p1: isPt(l?.p1) ? { ...l.p1, ...N(l.p1) } : l?.p1,
            p2: isPt(l?.p2) ? { ...l.p2, ...N(l.p2) } : l?.p2,
          }))
        : lines;
    if (next.type === "POLYGON") {
      if (Array.isArray(next.meshLines)) {
        next.meshLines = mapMeshLines(next.meshLines);
        changed = true;
      }
      if (next.meshLinesBySegment && typeof next.meshLinesBySegment === "object") {
        const out = {};
        for (const [seg, lines] of Object.entries(next.meshLinesBySegment)) {
          out[seg] = mapMeshLines(lines);
        }
        next.meshLinesBySegment = out;
        changed = true;
      }
    }

    // pixel-unit fields
    if (k !== 1) {
      if (next.labelDelta && typeof next.labelDelta === "object") {
        const ld = {};
        for (const [key, v] of Object.entries(next.labelDelta)) {
          ld[key] = isPt(v) ? { ...v, x: S(v.x), y: S(v.y) } : v;
        }
        next.labelDelta = ld;
        changed = true;
      }
      if (scaleAnnotationPxFields(next, k)) changed = true;
    }
    // own text size in page points: rendered at imageLongSide / pageLongSide
    if (Number.isFinite(Number(next.fontSize)) && next.fontSize !== "" && longRatio !== 1) {
      next.fontSize = Number(next.fontSize) * longRatio;
      changed = true;
    }

    if (changed) annotationsToPut.push(next);
  }

  // other versions (reference-px transforms)
  const versionUpdates = versions
    .filter((v) => v.id !== pdfVersion.id)
    .map((v) => {
      const t = v.transform ?? IDENTITY;
      const p = PX({ x: t.x ?? 0, y: t.y ?? 0 });
      return {
        key: v.id,
        changes: {
          transform: { ...t, x: p.x, y: p.y, scale: S(t.scale ?? 1) },
        },
      };
    });

  // photos (normalized point)
  const photos = (
    await db.photos.where("baseMapId").equals(baseMapId).toArray()
  ).filter((p) => isPt(p.point));
  const photoUpdates = photos.map((p) => ({
    key: p.id,
    changes: { point: { ...p.point, ...N(p.point) } },
  }));

  // photo plans calibrated on this plan
  const photoPlans = (
    await db.photoPlans.where("projectId").equals(record.projectId).toArray()
  ).filter((pp) => pp.calibrationInputs?.planBaseMapId === baseMapId);
  const photoPlanUpdates = photoPlans.map((pp) => {
    const targets = pp.calibrationInputs.planTargets ?? {};
    const nextTargets = {};
    for (const [key, v] of Object.entries(targets)) {
      nextTargets[key] = isPt(v) ? { ...v, ...N(v) } : v;
    }
    return {
      key: pp.id,
      changes: {
        calibrationInputs: { ...pp.calibrationInputs, planTargets: nextTargets },
        calibration: null,
      },
    };
  });

  // POVs framed on this base map (footprint in image px)
  const povs = (
    await db.povs.where("projectId").equals(record.projectId).toArray()
  ).filter((p) => p.baseMaps?.mainBaseMapId === baseMapId && p.camera2d?.footprint);
  const povUpdates = povs.map((p) => {
    const f = p.camera2d.footprint;
    const c = PX({ x: f.cx ?? 0, y: f.cy ?? 0 });
    return {
      key: p.id,
      changes: {
        camera2d: {
          ...p.camera2d,
          footprint: {
            ...f,
            cx: c.x,
            cy: c.y,
            ...(Number.isFinite(f.width) ? { width: S(f.width) } : {}),
            ...(Number.isFinite(f.height) ? { height: S(f.height) } : {}),
          },
        },
      },
    };
  });

  // portfolio containers (viewBox in reference px)
  const containers = (
    await db.portfolioBaseMapContainers
      .where("projectId")
      .equals(record.projectId)
      .toArray()
  ).filter((c) => c.baseMapId === baseMapId && c.viewBox);
  const containerUpdates = containers.map((c) => {
    const vb = c.viewBox;
    const p = PX({ x: vb.x ?? 0, y: vb.y ?? 0 });
    return {
      key: c.id,
      changes: {
        viewBox: {
          ...vb,
          x: p.x,
          y: p.y,
          ...(Number.isFinite(vb.width) ? { width: S(vb.width) } : {}),
          ...(Number.isFinite(vb.height) ? { height: S(vb.height) } : {}),
        },
      },
    };
  });

  // 3D placement: the image plane centre moves with the crop centre
  const baseMapChanges = {
    refWidth: newSize.width,
    refHeight: newSize.height,
    image: newImage,
    createdFrom: {
      ...createdFrom,
      bboxInRatio: { ...newBbox },
      dpi: newDpi,
      versionId: pdfVersion.id,
      regeneratedAt: new Date().toISOString(),
    },
  };
  const oldMeterByPx = Number(record.meterByPx);
  if (Number.isFinite(oldMeterByPx) && oldMeterByPx > 0) {
    baseMapChanges.meterByPx = oldMeterByPx / k;
    const scale = Number(createdFrom.blueprintScale);
    const pageWidthM =
      Number.isFinite(scale) && scale > 0
        ? (viewport1.width / POINTS_PER_INCH) * METER_PER_INCH * scale
        : viewportOld.width * oldMeterByPx;
    const pageHeightM =
      Number.isFinite(scale) && scale > 0
        ? (viewport1.height / POINTS_PER_INCH) * METER_PER_INCH * scale
        : viewportOld.height * oldMeterByPx;
    const dcx = (newBbox.x1 + newBbox.x2) / 2 - (oldBbox.x1 + oldBbox.x2) / 2;
    const dcy = (newBbox.y1 + newBbox.y2) / 2 - (oldBbox.y1 + oldBbox.y2) / 2;
    if (dcx !== 0 || dcy !== 0) {
      const world = baseMapLocalToWorld(
        { x: dcx * pageWidthM, y: -(dcy * pageHeightM) },
        getBaseMapTransform(record)
      );
      baseMapChanges.position = { x: world.x, y: world.y, z: world.z };
    }
  }

  // old image file: dropped when no other live version still uses it
  const oldFileName = pdfVersion.image?.fileName;
  const oldFileStillUsed = versions.some(
    (v) => v.id !== pdfVersion.id && v.image?.fileName === oldFileName
  );

  // --- write ---
  await withSystemWrite(() =>
    withoutUndo(() =>
      db.transaction(
        "rw",
        [
          db.files,
          db.baseMaps,
          db.baseMapVersions,
          db.points,
          db.annotations,
          db.photos,
          db.photoPlans,
          db.povs,
          db.portfolioBaseMapContainers,
        ],
        async () => {
          await db.files.put(newFileRecord);
          if (oldFileName && !oldFileStillUsed) {
            await db.files.delete(oldFileName);
          }
          await db.baseMapVersions.update(pdfVersion.id, {
            image: newImage,
            transform: { ...IDENTITY },
          });
          if (versionUpdates.length > 0) {
            await db.baseMapVersions.bulkUpdate(versionUpdates);
          }
          await db.baseMaps.update(baseMapId, baseMapChanges);
          if (pointsToPut.length > 0) await db.points.bulkPut(pointsToPut);
          if (annotationsToPut.length > 0) {
            await db.annotations.bulkPut(annotationsToPut);
          }
          if (photoUpdates.length > 0) await db.photos.bulkUpdate(photoUpdates);
          if (photoPlanUpdates.length > 0) {
            await db.photoPlans.bulkUpdate(photoPlanUpdates);
          }
          if (povUpdates.length > 0) await db.povs.bulkUpdate(povUpdates);
          if (containerUpdates.length > 0) {
            await db.portfolioBaseMapContainers.bulkUpdate(containerUpdates);
          }
        }
      )
    )
  );

  // A partial undo would leave a mixed-frame state: the stack is dropped.
  clearUndo();
  notifyLocalChange();

  dispatch?.(triggerEntitiesTableUpdate("baseMaps"));
  dispatch?.(triggerBaseMapsUpdate());
  dispatch?.(triggerAnnotationsUpdate());

  return {
    baseMapId,
    newSize,
    k,
    translation: T.d,
    counts: {
      points: pointsToPut.length,
      annotations: annotationsToPut.length,
      versions: versionUpdates.length,
      photos: photoUpdates.length,
      photoPlans: photoPlanUpdates.length,
      povs: povUpdates.length,
      containers: containerUpdates.length,
    },
  };
}
