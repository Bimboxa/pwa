import theme from "Styles/theme";

const secondary = theme.palette.secondary.main;

// ---------------------------------------------------------------------------
// DRAWING_SHAPE_CONFIG — single source of truth for each drawingShape
// ---------------------------------------------------------------------------
//
// drawingShape = what the annotation looks like on the map / in the legend.
// Each entry defines:
//   - label:            UI display name
//   - annotationType:   the annotation `type` written to DB
//   - tools:            available drawing tool keys (from drawingTools.jsx)
//   - configurableProps: style properties that can be set on a template
//   - defaults:         default values for those properties
//   - shapeCategory:    icon category for AnnotationTemplateIcon rendering
// ---------------------------------------------------------------------------

const DRAWING_SHAPE_CONFIG = {
  MARKER: {
    label: "Repère",
    annotationType: "MARKER",
    tools: ["ONE_CLICK"],
    configurableProps: ["fillColor", "iconKey"],
    defaults: {
      fillColor: "#f44336",
      iconKey: "circle",
    },
    shapeCategory: "circle",
  },
  POINT: {
    label: "Point",
    annotationType: "POINT",
    tools: ["ONE_CLICK"],
    configurableProps: ["fillColor", "variant", "size", "sizeUnit", "height"],
    defaults: {
      fillColor: "#2196f3",
      variant: "CIRCLE",
      size: 20,
      sizeUnit: "PX",
    },
    shapeCategory: "circle",
  },
  TEXT: {
    label: "Texte",
    annotationType: "TEXT",
    tools: ["ONE_CLICK"],
    configurableProps: ["fillColor"],
    defaults: {
      fillColor: secondary,
    },
    shapeCategory: "circle",
  },
  LABEL: {
    label: "Étiquette",
    annotationType: "LABEL",
    tools: ["ONE_CLICK"],
    configurableProps: ["fillColor"],
    defaults: {
      fillColor: secondary,
    },
    shapeCategory: "circle",
  },
  // DETAIL — a "detail bubble": white circle with a thick ring containing a
  // short label, plus a filled triangular arrow whose TIP is the annotation's
  // stored point. arrowAngle (degrees, SVG screen convention: 0 = right,
  // clockwise-positive) orients the arrow; the bubble sits opposite it at a
  // fixed SCREEN-px distance, so the tip never moves on rotation or zoom.
  DETAIL: {
    label: "Détail",
    annotationType: "DETAIL",
    tools: ["ONE_CLICK"],
    configurableProps: ["fillColor"],
    defaults: {
      fillColor: secondary,
      arrowAngle: 0,
    },
    shapeCategory: "circle",
  },
  IMAGE: {
    label: "Image",
    annotationType: "IMAGE",
    tools: ["ONE_CLICK"],
    configurableProps: ["image", "meterByPx"],
    defaults: {},
    shapeCategory: "circle",
  },
  POLYLINE: {
    label: "Ligne",
    annotationType: "POLYLINE",
    tools: [
      "POLYLINE_CLICK",
      "POLYLINE_SEGMENT",
      "POLYLINE_RECTANGLE",
      "POLYLINE_CIRCLE",
      "POLYLINE_CIRCLE_RADIUS",
      "POLYLINE_ARC",
      "STRIP",
      "STRIP_SEGMENT",
    ],
    configurableProps: [
      "strokeColor",
      "strokeWidth",
      "strokeWidthUnit",
      "strokeOpacity",
      "strokeType",
      "strokeOffset",
      "height",
      "color3D",
      "opacity3D",
      "material3d",
    ],
    defaults: {
      strokeColor: secondary,
      strokeWidth: 2,
      strokeWidthUnit: "PX",
      strokeOpacity: 1,
      strokeType: "SOLID",
    },
    shapeCategory: "polyline",
  },
  POLYGON: {
    label: "Surface",
    annotationType: "POLYGON",
    tools: [
      "POLYGON_CLICK",
      "POLYGON_RECTANGLE",
      "POLYGON_CIRCLE",
      "POLYGON_CIRCLE_RADIUS",
      "SURFACE_DROP",
      "STRIP",
      "STRIP_SEGMENT",
      "RAMP",
    ],
    configurableProps: [
      "fillColor",
      "fillOpacity",
      "fillType",
      "hideSlope",
      "height",
      "color3D",
      "opacity3D",
      "material3d",
    ],
    defaults: {
      fillColor: secondary,
      fillOpacity: 0.8,
      fillType: "SOLID",
      strokeColor: secondary,
      strokeWidth: 2,
      strokeOpacity: 1,
      hideSlope: false,
    },
    shapeCategory: "rectangle",
  },
  OPENING: {
    label: "Ouverture",
    annotationType: "POLYLINE",
    tools: ["OPENING_SEGMENT"],
    configurableProps: [
      "width", // opening width ALONG the wall, meters
      "strokeColor",
      "strokeWidth",
      "strokeWidthUnit",
      "strokeOpacity",
      "height", // opening height, meters (3D / quantities)
    ],
    defaults: {
      isOpening: true, // rides into the draft via {...defaults}
      width: 0.9,
      height: 2.1,
      strokeColor: "#ff0000", // OPENING_COLOR (buildToolDraft.js)
      strokeWidth: 20,
      strokeWidthUnit: "CM",
      strokeOpacity: 0.8,
      strokeType: "SOLID",
    },
    shapeCategory: "polyline",
  },
  OBJECT_3D: {
    label: "Objet 3D",
    annotationType: "OBJECT_3D",
    tools: ["ONE_CLICK"],
    configurableProps: ["object3D"],
    defaults: {},
    shapeCategory: "rectangle",
  },
  // LINEAR_LAYOUT — "calepinage linéaire": a distribution of parallel bars
  // along an axis with a density. Drawn as a 2-point segment (the bottom edge
  // of the band); the band of `width` meters extends perpendicular on one side
  // (stripOrientation flips the side, STRIP-style). Bar thickness rides on
  // strokeWidth/strokeWidthUnit (CM). Density is defined either as a spacing
  // in cm (densityMode "SPACING") or a count per meter ("PER_METER"), with a
  // free-text densityUnitLabel (e.g. "jonc/m") shown in the rendered label.
  // layoutAlign (LEFT / CENTER / RIGHT) anchors the bar grid on the segment
  // and drives the bar count (see getLinearLayoutBars.js).
  LINEAR_LAYOUT: {
    label: "Calepinage linéaire",
    annotationType: "LINEAR_LAYOUT",
    tools: ["LINEAR_LAYOUT_SEGMENT"],
    configurableProps: [
      "strokeColor",
      "strokeWidth",
      "strokeWidthUnit",
      "strokeOpacity",
      "width",
      "densityMode",
      "densityValue",
      "densityUnitLabel",
      "layoutAlign",
      // Where the ticked ruler sits across the band: MIDDLE, or BOTTOM / TOP
      // (at 25% from the corresponding edge).
      "axisPosition",
      // Where the two-line text sits along the ruler: LEFT / CENTER / RIGHT.
      "textAlign",
      // Hide the pale band rectangle (keep only text + sample bar + ruler).
      "hideBandFill",
    ],
    defaults: {
      strokeColor: secondary,
      strokeWidth: 15,
      strokeWidthUnit: "CM",
      strokeOpacity: 1,
      fillOpacity: 0.15,
      width: 5,
      densityMode: "SPACING",
      densityValue: 33,
      densityUnitLabel: "jonc/m",
      layoutAlign: "CENTER",
      axisPosition: "MIDDLE",
      textAlign: "CENTER",
      hideBandFill: false,
      stripOrientation: 1,
    },
    shapeCategory: "polyline",
  },
  // Revolution helpers — geometry that defines a surface-of-revolution shape3D
  // (REVOLUTION). REVOLUTION_AXIS is a template-drivable shape: axes are drawn
  // from an annotationTemplate row of the listings panel.
  //
  // REVOLUTION_AXIS is authored on a HORIZONTAL base map (vue en plan) with two
  // clicks: the centre, then a point giving the radius AND the diameter
  // direction. See getRevolutionAxisPlanFrame for the storage contract.
  REVOLUTION_AXIS: {
    label: "Axe de révolution",
    annotationType: "REVOLUTION_AXIS",
    tools: ["REVOLUTION_AXIS_PLAN"],
    configurableProps: ["strokeColor", "strokeWidth", "strokeWidthUnit"],
    defaults: {
      strokeColor: secondary,
      // Always 2 px on screen regardless of zoom.
      strokeWidth: 2,
      strokeWidthUnit: "PX",
      strokeOpacity: 1,
      strokeType: "SOLID",
      // Geometry (radiusM / directionDeg are written at commit from the two
      // clicks; the values here only matter for a keyboard-less fallback).
      radiusM: 1,
      directionDeg: 0,
      // Swaps the orange / black half-discs, i.e. re-places the linked vertical
      // base maps at angleDeg + 180°.
      invertHalf: false,
      // Partial revolution (sector) shared by every arc bound to this axis.
      partialRevolution: false,
      // Absolute world Z of the axis centre, and the axis height as drawn on
      // the elevation view.
      offsetZ: 0,
      height: 5,
    },
    shapeCategory: "circle",
  },
  // Instance of a plan axis dropped on a VERTICAL base map. Its single point is
  // where the axis centre sits in that elevation image — placing it re-poses
  // the base map in 3D (see computeVerticalBaseMapPlacementFromAxis). Never a
  // user-creatable template shape (empty tools, absent from DRAWING_SHAPES):
  // placements are armed from the axis template row on a vertical base map.
  REVOLUTION_AXIS_PLACEMENT: {
    label: "Position de l'axe",
    annotationType: "REVOLUTION_AXIS_PLACEMENT",
    tools: [],
    configurableProps: ["strokeColor"],
    defaults: {
      strokeColor: secondary,
      strokeWidth: 2,
      strokeWidthUnit: "PX",
      strokeOpacity: 1,
    },
    shapeCategory: "circle",
  },
  // RULER — a dimension CHAIN: a polyline whose every segment carries its own
  // cote, all of them aligned on a single offset "alignment line" (a miter
  // offset of the polyline, so non-collinear segments stay joined). Reuses the
  // COTE display fields (unit / decimals / fontSize / …) and the signed
  // `extensionOffset` (its sign picks the side the cotes sit on).
  RULER: {
    label: "Règle",
    annotationType: "RULER",
    tools: ["RULER_CLICK", "RULER_SEGMENT"],
    configurableProps: [
      "strokeColor",
      "strokeWidth",
      "strokeWidthUnit",
      "strokeOpacity",
      "strokeType",
      "unit",
      "extensionOffset",
      "extensionOffsetUnit",
      "decimals",
      "fontSize",
      "showUnitLabel",
      "showTotalCote",
      "showRulerLabel",
    ],
    defaults: {
      strokeColor: "#000000",
      strokeWidth: 1,
      strokeWidthUnit: "PX",
      strokeOpacity: 1,
      strokeType: "SOLID",
      unit: "M",
      extensionOffset: 40,
      extensionOffsetUnit: "PX",
      decimals: 2,
      fontSize: 14,
      showUnitLabel: true,
      showTotalCote: false,
      showRulerLabel: false,
    },
    shapeCategory: "polyline",
  },
  COTE: {
    label: "Cote",
    annotationType: "COTE",
    tools: ["COTE_TWO_CLICK"],
    configurableProps: [
      "strokeColor",
      "strokeWidth",
      "strokeWidthUnit",
      "unit",
      "extensionOffset",
      "extensionOffsetUnit",
      "decimals",
      "fontSize",
      "showUnitLabel",
    ],
    defaults: {
      strokeColor: "#000000",
      strokeWidth: 1,
      strokeWidthUnit: "PX",
      strokeOpacity: 1,
      strokeType: "SOLID",
      unit: "CM",
      extensionOffset: 8,
      extensionOffsetUnit: "PX",
      decimals: 0,
      fontSize: 18,
      showUnitLabel: true,
    },
    shapeCategory: "polyline",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Revolution helpers, template-linked since the REVOLUTION_AXIS shape became
// template-drivable, are normal listing annotations (listingId +
// annotationTemplateId + layerId) — with residual special cases: single-point
// storage, no entity, record-level `hidden`. Rows created by the pre-template
// model (no annotationTemplateId) keep the historical exemptions: scopeId
// instead of listingId, and a bypass of the listing / layer / scope visibility
// filters. Kept here (rather than re-listed in each consumer) because the same
// predicates are needed by useAnnotationsV2, SectionLayers and the commit path.
export const REVOLUTION_HELPER_TYPES = [
  "REVOLUTION_AXIS",
  "REVOLUTION_AXIS_PLACEMENT",
];

export function isRevolutionHelperType(type) {
  return REVOLUTION_HELPER_TYPES.includes(type);
}

// Pre-template axis / placement rows: they carry no annotationTemplateId, so
// they cannot flow through the template-driven listing / layer / scope filters
// and keep the historical global-visibility bypass (soft compat, no migration).
export function isLegacyStyleRevolutionHelper(annotation) {
  return (
    isRevolutionHelperType(annotation?.type) && !annotation.annotationTemplateId
  );
}

// Rows written by the PREVIOUS revolution-axis model are ignored everywhere.
// Their geometry contract is incompatible with the current one:
//   - the old REVOLUTION_AXIS was an elevation 2-point line (`points`), whereas
//     the current one is a plan CENTRE (`point`) + radiusM / directionDeg,
//   - REVOLUTION_POINT (the old plan marker) no longer exists at all.
// Ignoring them is deliberate (no migration): a legacy axis carries neither a
// radius nor an orientation, so it cannot be reconstructed. They stay in the
// database, simply unread.
export function isLegacyRevolutionRecord(annotation) {
  if (!annotation) return false;
  if (annotation.type === "REVOLUTION_POINT") return true;
  return annotation.type === "REVOLUTION_AXIS" && !annotation.point?.id;
}

export function getShapeConfig(drawingShape) {
  return DRAWING_SHAPE_CONFIG[drawingShape] ?? null;
}

export function getDefaultsForShape(drawingShape) {
  return DRAWING_SHAPE_CONFIG[drawingShape]?.defaults ?? {};
}

export function getConfigurableProps(drawingShape) {
  return DRAWING_SHAPE_CONFIG[drawingShape]?.configurableProps ?? [];
}

export function getToolsForShape(drawingShape) {
  return DRAWING_SHAPE_CONFIG[drawingShape]?.tools ?? [];
}

export function getAnnotationType(drawingShape) {
  return DRAWING_SHAPE_CONFIG[drawingShape]?.annotationType ?? null;
}

export function getShapeCategory(drawingShape) {
  return DRAWING_SHAPE_CONFIG[drawingShape]?.shapeCategory ?? "circle";
}

// Reverse mapping: annotation type → drawingShape (for backward compat)
const TYPE_TO_SHAPE = {
  MARKER: "MARKER",
  POINT: "POINT",
  TEXT: "TEXT",
  LABEL: "LABEL",
  DETAIL: "DETAIL",
  IMAGE: "IMAGE",
  POLYLINE: "POLYLINE",
  STRIP: "POLYLINE",
  POLYGON: "POLYGON",
  RECTANGLE: "POLYGON",
  OBJECT_3D: "OBJECT_3D",
  LINEAR_LAYOUT: "LINEAR_LAYOUT",
  COTE: "COTE",
  RULER: "RULER",
  REVOLUTION_AXIS: "REVOLUTION_AXIS",
  REVOLUTION_AXIS_PLACEMENT: "REVOLUTION_AXIS_PLACEMENT",
};

export function resolveDrawingShapeFromType(annotationType) {
  return TYPE_TO_SHAPE[annotationType] ?? null;
}

// Legacy drawingShape → new drawingShape (for old templates)
const LEGACY_SHAPE_MAP = {
  POINT_2D: null, // needs template.type to resolve
  POLYLINE_2D: "POLYLINE",
  SURFACE_2D: "POLYGON",
};

export function resolveDrawingShape(template) {
  if (!template) return null;
  const shape = template.drawingShape;

  // Already a new-style value
  if (DRAWING_SHAPE_CONFIG[shape]) return shape;

  // Legacy value — try mapping
  const mapped = LEGACY_SHAPE_MAP[shape];
  if (mapped) return mapped;

  // POINT_2D needs type to disambiguate
  if (shape === "POINT_2D" && template.type) {
    return TYPE_TO_SHAPE[template.type] ?? "MARKER";
  }

  // No drawingShape at all — derive from type
  if (template.type) {
    return TYPE_TO_SHAPE[template.type] ?? null;
  }

  return null;
}

export default DRAWING_SHAPE_CONFIG;
