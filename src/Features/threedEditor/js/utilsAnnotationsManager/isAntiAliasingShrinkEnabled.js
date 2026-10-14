// Gate of the render-only anti-aliasing geometry tweaks (« Séparer les
// surfaces en contact »): the footprint / top shrink of CM POLYLINE and STRIP
// elements (createAnnotationObject3D) and the POLYGON « Delta offset 3D »
// lift (getAnnotationVerticalLift). `options.antiAliasingShrink` is the
// session toggle (threedEditor.antiAliasingShrink, OFF by default).
// Hosts of painted parts (« Pinceau ») and annotations being converted to a
// mesh are built WITHOUT the tweaks: their faces are measured and kept as is
// (useAutoLoadAnnotationsInThreedEditor tags them `_noAntiAliasingShrink`).
export default function isAntiAliasingShrinkEnabled(options, annotation) {
  return Boolean(
    options?.antiAliasingShrink && !annotation?._noAntiAliasingShrink
  );
}
