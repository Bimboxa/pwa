export default function getMousePositionInStage(stage) {
  const pos = stage.getPointerPosition();
  const scale = stage.scaleX();

  return {
    x: (pos.x - stage.x()) / scale,
    y: (pos.y - stage.y()) / scale,
  };
}
