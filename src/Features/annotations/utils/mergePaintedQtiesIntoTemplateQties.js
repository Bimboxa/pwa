// Painted parts (« Pinceau » 3D, db.meshPaints) joined to the per-template
// annotation quantities — node-testable (relative imports only).
//
// A painted face adds its m² and a painted edge its ml to the PAINTING
// template's totals. `count` (annotations) and `unit` stay untouched: a
// painted part is not an annotation. `mainQtyLabel` keeps the exact
// "${qty} ${unit}" format (parseMainQtyLabel / applyHardCodedQties depend on
// it) — except MESH_3D_QTY_LABEL, the unit then comes from `mainQtyUnit`; the
// faces / edges count only goes in the secondary line.
//
// Mesh 3D rule (stats.mesh3dCount > 0): the template has NO surface / length
// total at all — `length` / `surface` stay null, the painted parts are not
// added either, the label is "⚠ 3D" and only the unit count remains. The
// painted detail is still kept for the tooltip.
import getAnnotationTemplateMainQtyLabel, {
  MESH_3D_QTY_LABEL,
} from "./getAnnotationTemplateMainQtyLabel.js";

const EMPTY_BASE = Object.freeze({
  count: 0,
  length: 0,
  surface: 0,
  unit: 0,
  mesh3dCount: 0,
  mainQtyLabel: "-",
});

const num = (v) => (Number.isFinite(v) ? v : 0);

const hasMesh3d = (stats) => (stats?.mesh3dCount ?? 0) > 0;

// Annotation `type` a drawingShape-only template draws (dialog-created and
// library templates carry no `type`): the main quantity label picks its
// default unit from it. Local mirror of drawingShapeConfig's annotationType
// for the shapes that carry m² / ml (kept alias-free: node-testable).
const SHAPE_TO_TYPE = {
  POLYGON: "POLYGON",
  SURFACE_2D: "POLYGON",
  POLYLINE: "POLYLINE",
  POLYLINE_2D: "POLYLINE",
  OPENING: "POLYLINE",
  CIRCULATION: "POLYLINE",
  LINEAR_LAYOUT: "LINEAR_LAYOUT",
};

function withEffectiveType(template) {
  if (template.type || template.mainQtyKey) return template;
  const type = SHAPE_TO_TYPE[template.drawingShape];
  return type ? { ...template, type } : template;
}

/**
 * @param {Object<string, Object>|null} qtiesById - per-template annotation
 *   stats ({count, length, surface, unit, mainQtyLabel}, e.g.
 *   computeAnnotationTemplateQties).
 * @param {Object<string, Object>|null} paintedByTemplateId -
 *   aggregatePaintedPartsByTemplate(...).byTemplateId.
 * @param {Object<string, Object>} templateById
 * @returns {Object<string, Object>} a NEW map when some template has painted
 *   parts (untouched entries keep their identity), else `qtiesById` itself.
 *   Merged entries add: annotationsSurface, annotationsLength,
 *   paintedSurface, paintedLength, paintedCount (counted parts),
 *   paintedFacesCount, paintedEdgesCount, paintedOrphansCount,
 *   paintedConflictsCount, paintedStaleCount, paintedListedCount.
 */
export default function mergePaintedQtiesIntoTemplateQties(
  qtiesById,
  paintedByTemplateId,
  templateById
) {
  const paintedEntries = Object.entries(paintedByTemplateId ?? {}).filter(
    ([, painted]) => (painted?.listedCount ?? 0) > 0
  );
  if (paintedEntries.length === 0) return qtiesById;

  const out = { ...(qtiesById ?? {}) };

  for (const [templateId, painted] of paintedEntries) {
    const base = qtiesById?.[templateId] ?? EMPTY_BASE;
    const mesh3d = hasMesh3d(base);
    const annotationsSurface = mesh3d ? null : num(base.surface);
    const annotationsLength = mesh3d ? null : num(base.length);
    const paintedSurface = num(painted.surface);
    const paintedLength = num(painted.length);

    const stats = {
      ...base,
      annotationsSurface,
      annotationsLength,
      paintedSurface,
      paintedLength,
      paintedCount: painted.partsCount ?? 0,
      paintedFacesCount: painted.facesCount ?? 0,
      paintedEdgesCount: painted.edgesCount ?? 0,
      paintedOrphansCount: painted.orphansCount ?? 0,
      paintedConflictsCount: painted.conflictsCount ?? 0,
      paintedStaleCount: painted.staleCount ?? 0,
      paintedListedCount: painted.listedCount ?? 0,
      // Mesh 3D: no total — the painted parts are not added either.
      surface: mesh3d ? null : annotationsSurface + paintedSurface,
      length: mesh3d ? null : annotationsLength + paintedLength,
    };

    const template = templateById?.[templateId];
    stats.mainQtyLabel = template
      ? getAnnotationTemplateMainQtyLabel(withEffectiveType(template), stats)
      : `${stats.unit ?? "-"} u`;

    out[templateId] = stats;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Secondary line + tooltip of a template row (Dessin / Viewer panels, detail
// view). Same number format as the panels (2 decimals, "0" for zero).
// ---------------------------------------------------------------------------

export function formatQtyValue(value, decimals = 2) {
  return Number.isFinite(value) && value !== 0 ? value.toFixed(decimals) : "0";
}

const plural = (n, word, pluralWord = `${word}s`) =>
  `${n} ${n > 1 ? pluralWord : word}`;

/**
 * "3 faces", "4 arêtes", "7 parties" (both kinds), "1 partie non comptée"
 * (only orphans / conflicts) or null (no painted part).
 */
export function getPaintedPartsCountLabel(stats) {
  const faces = stats?.paintedFacesCount ?? 0;
  const edges = stats?.paintedEdgesCount ?? 0;
  const listed = stats?.paintedListedCount ?? 0;
  if (faces > 0 && edges > 0) return plural(faces + edges, "partie");
  if (faces > 0) return plural(faces, "face");
  if (edges > 0) return plural(edges, "arête");
  if (listed > 0)
    return `${plural(listed, "partie")} non comptée${listed > 1 ? "s" : ""}`;
  return null;
}

/**
 * Secondary line of a template row:
 * - nothing: "0 annot."
 * - annotations only: "2 u · 14.00 ml · 30.20 m²" (unchanged)
 * - annotations + paints: "2 u · 14.00 ml · 42.60 m² · 3 faces" (totals)
 * - paints only: "12.40 m² · 3 faces" / "6.20 ml · 4 arêtes"
 * - with a mesh 3D annotation: "2 u · ⚠ 3D" (no ml / m² at all; the painted
 *   parts count may follow: "2 u · ⚠ 3D · 3 faces")
 *
 * @param {Object} stats - merged template stats.
 * @param {number} [annotationsCount] - defaults to stats.count.
 */
export function formatTemplateQtiesLine(stats, annotationsCount) {
  const count = annotationsCount ?? stats?.count ?? 0;
  const listed = stats?.paintedListedCount ?? 0;
  if (count === 0 && listed === 0) return "0 annot.";

  const items = [];
  if (hasMesh3d(stats)) {
    items.push(`${formatQtyValue(stats?.unit ?? 0, 0)} u`, MESH_3D_QTY_LABEL);
  } else if (count > 0) {
    items.push(
      `${formatQtyValue(stats?.unit ?? 0, 0)} u`,
      `${formatQtyValue(stats?.length ?? 0)} ml`,
      `${formatQtyValue(stats?.surface ?? 0)} m²`
    );
  } else {
    if ((stats?.paintedEdgesCount ?? 0) > 0)
      items.push(`${formatQtyValue(stats?.length ?? 0)} ml`);
    if ((stats?.paintedFacesCount ?? 0) > 0)
      items.push(`${formatQtyValue(stats?.surface ?? 0)} m²`);
  }
  const countLabel = getPaintedPartsCountLabel(stats);
  if (countLabel) items.push(countLabel);
  return items.join(" · ");
}

/**
 * "1 annotation en mesh 3D : …" / "3 annotations en mesh 3D : …", null when
 * the template holds no mesh 3D annotation.
 */
export function getMesh3dQtiesNotice(stats) {
  const n = stats?.mesh3dCount ?? 0;
  if (n === 0) return null;
  return (
    `${plural(n, "annotation")} en mesh 3D : le total surface / linéaire ` +
    "du modèle n'est pas calculé. Les faces / arêtes se mesurent " +
    "individuellement (sélection, Pinceau)."
  );
}

/**
 * Tooltip splitting annotations / painted parts, null without painted part:
 * "Annotations : 17.80 m² — Parties peintes : 12.40 m² (3 faces)".
 * With a mesh 3D annotation the notice comes first and the annotations
 * total reads "⚠ 3D"; the painted detail stays indicative.
 */
export function formatTemplateQtiesTooltip(stats) {
  const mesh3dNotice = getMesh3dQtiesNotice(stats);
  if (!(stats?.paintedListedCount > 0)) return mesh3dNotice;
  const hasEdges = (stats.paintedEdgesCount ?? 0) > 0;
  const hasFaces = (stats.paintedFacesCount ?? 0) > 0 || !hasEdges;

  const qtyLine = (length, surface) =>
    [
      hasEdges ? `${formatQtyValue(length ?? 0)} ml` : null,
      hasFaces ? `${formatQtyValue(surface ?? 0)} m²` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const items = [
    ...(mesh3dNotice ? [mesh3dNotice] : []),
    `Annotations : ${
      mesh3dNotice
        ? MESH_3D_QTY_LABEL
        : qtyLine(stats.annotationsLength, stats.annotationsSurface)
    }`,
    `Parties peintes : ${qtyLine(stats.paintedLength, stats.paintedSurface)}` +
      ((stats.paintedCount ?? 0) > 0
        ? ` (${getPaintedPartsCountLabel(stats)})`
        : ""),
  ];
  const orphans = stats.paintedOrphansCount ?? 0;
  if (orphans > 0)
    items.push(
      `${plural(orphans, "orpheline")} (non comptée${orphans > 1 ? "s" : ""})`
    );
  const conflicts = stats.paintedConflictsCount ?? 0;
  if (conflicts > 0)
    items.push(
      `${plural(conflicts, "doublon")} (non compté${conflicts > 1 ? "s" : ""})`
    );
  const stale = stats.paintedStaleCount ?? 0;
  if (stale > 0) items.push(`${stale} à vérifier (ouvrir en 3D)`);
  return items.join(" — ");
}
