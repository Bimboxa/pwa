// A maille label drag (useMesh3dLabelDragHandlers) owns the whole pointer
// gesture: it starts on a pointerdown that hit a label sprite and ends on the
// window-level pointerup. The label sprites are Sprites, so the pointerup
// pick paths of the meshing tools / MainThreedEditor cannot see them and
// would act on whatever geometry lies behind the card (re-selecting or
// deselecting). They check this flag and bail out for the duration.
//
// A module flag rather than stopImmediatePropagation: every handler is
// registered on the same canvas element, where listeners run in registration
// order regardless of the capture flag — propagation tricks are not reliable.

let _active = false;

export function setMesh3dLabelGestureActive(active) {
  _active = Boolean(active);
}

export function isMesh3dLabelGestureActive() {
  return _active;
}
