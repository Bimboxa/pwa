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
    configurableProps: ["fillColor", "variant", "size", "sizeUnit"],
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
      "POLYLINE_RECTANGLE",
      "POLYLINE_CIRCLE",
      "POLYLINE_ARC",
      "STRIP",
    ],
    configurableProps: [
      "strokeColor",
      "strokeWidth",
      "strokeWidthUnit",
      "strokeOpacity",
      "strokeType",
      "strokeOffset",
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
      "SURFACE_DROP",
      "STRIP",
    ],
    configurableProps: ["fillColor", "fillOpacity", "fillType"],
    defaults: {
      fillColor: secondary,
      fillOpacity: 0.8,
      fillType: "SOLID",
      strokeColor: secondary,
      strokeWidth: 2,
      strokeOpacity: 1,
    },
    shapeCategory: "rectangle",
  },
  OBJECT_3D: {
    label: "Objet 3D",
    annotationType: "OBJECT_3D",
    tools: ["ONE_CLICK"],
    configurableProps: ["object3D"],
    defaults: {},
    shapeCategory: "rectangle",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  IMAGE: "IMAGE",
  POLYLINE: "POLYLINE",
  STRIP: "POLYLINE",
  POLYGON: "POLYGON",
  RECTANGLE: "POLYGON",
  OBJECT_3D: "OBJECT_3D",
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
