// Whether the drawing tools ("Commandes": Dessin, Ouverture, cuts, Joindre,
// Axe de révolution, Déplacer, Tourner…) are offered by the annotations popper
// / the PopperDrawingTools popper: DRAW mode and "no mode" (null, draws like
// DRAW), always in the ZONES module (openings / splits on the zone
// delimitation polygons) and in a business-objects module without an active
// object (edit-only panel: cuts / openings on existing annotations stay
// possible). Never in locate-business-object mode.
export default function selectShowDrawingTools({
  effectiveInteractionMode,
  isZonesViewer,
  isBusinessObjectsModuleNoObject,
  isLocateBusinessObjectMode,
}) {
  return (
    !isLocateBusinessObjectMode &&
    (effectiveInteractionMode === "DRAW" ||
      effectiveInteractionMode == null ||
      Boolean(isZonesViewer) ||
      Boolean(isBusinessObjectsModuleNoObject))
  );
}
