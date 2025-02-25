export default function getPointerPositionInStage(pointer, stage, options) {
  // edge case

  if (!pointer || !stage) return;

  // options

  const coordsInWindow = options?.coordsInWindow ?? false;

  // main

  const scale = stage.scaleX();
  const bbox = stage.container().getBoundingClientRect();

  const dx = coordsInWindow ? bbox.left + window.scrollX : 0;
  const dy = coordsInWindow ? bbox.top + window.scrollY : 0;

  return {
    x: (pointer.x - dx - stage.x()) / scale,
    y: (pointer.y - dy - stage.y()) / scale,
  };
}
