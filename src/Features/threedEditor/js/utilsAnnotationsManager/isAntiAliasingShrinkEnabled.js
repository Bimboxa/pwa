// Gate of the render-only anti-aliasing geometry tweaks (« Séparer les
// surfaces en contact »): the footprint / top shrink of the EXTRUDED CM
// POLYLINE and STRIP elements (a height > 0 — a flat or sloped surface is
// never contracted, createAnnotationObject3D) and the POLYGON « Delta offset
// 3D » lift (getAnnotationVerticalLift). These are the ONLY geometric
// offsets of the 3D build: with the toggle off, every element sits exactly at
// its drawn dimensions. `options.antiAliasingShrink` is the session toggle
// (threedEditor.antiAliasingShrink, ON by default).
// Hosts of painted parts (« Pinceau ») and annotations being converted to a
// mesh are built WITHOUT the tweaks: their faces are measured and kept as is
// (useAutoLoadAnnotationsInThreedEditor tags them `_noAntiAliasingShrink`).
export default function isAntiAliasingShrinkEnabled(options, annotation) {
  return Boolean(
    options?.antiAliasingShrink && !annotation?._noAntiAliasingShrink
  );
}
