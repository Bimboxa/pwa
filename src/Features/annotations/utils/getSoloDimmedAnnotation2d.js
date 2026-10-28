import {
  SOLO_DIM_STYLE,
  SOLO_DIM_WIREFRAME_COLOR,
} from "Features/annotations/constants/soloDimStyle";

// 2D look of an annotation LEFT OUT of a solo (`_soloDimmed`, kept by
// useAnnotationsV2 with keepSoloDimmed), per viewers.soloDimStyle:
//   - TRANSPARENT: the node renders as is inside a light grey translucent
//     <g> (greyscale, brightened, low opacity);
//   - WIREFRAME: outline types get their style fields overridden the way the
//     Planning "Play" mode restyles annotations (useAnnotationsV2
//     PLAY_STYLE_*): light grey solid stroke, no fill, no hatching, no label.
//     The other types (markers, images, texts, cotes…) have no outline to
//     keep: they fall back to the TRANSPARENT wrapper.
// Returns { annotation, wrapperStyle }.

const OUTLINE_TYPES = new Set([
  "POLYLINE",
  "POLYGON",
  "RECTANGLE",
  "STRIP",
  "DISC",
  "LINEAR_LAYOUT",
]);

export const SOLO_DIM_TRANSPARENT_WRAPPER_STYLE = {
  opacity: 0.25,
  filter: "grayscale(1) brightness(1.6)",
  pointerEvents: "none",
};

const SOLO_DIM_WIREFRAME_WRAPPER_STYLE = { pointerEvents: "none" };

const WIREFRAME_STYLE = {
  fillColor: SOLO_DIM_WIREFRAME_COLOR,
  fillOpacity: 0,
  fillType: "SOLID",
  strokeColor: SOLO_DIM_WIREFRAME_COLOR,
  strokeOpacity: 1,
  strokeType: "SOLID",
  showLabel: false,
};

export default function getSoloDimmedAnnotation2d(annotation, style) {
  if (
    style === SOLO_DIM_STYLE.WIREFRAME &&
    OUTLINE_TYPES.has(annotation.type)
  ) {
    return {
      annotation: { ...annotation, ...WIREFRAME_STYLE },
      wrapperStyle: SOLO_DIM_WIREFRAME_WRAPPER_STYLE,
    };
  }
  return {
    annotation,
    wrapperStyle: SOLO_DIM_TRANSPARENT_WRAPPER_STYLE,
  };
}
