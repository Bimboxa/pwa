import getPointerPositionInStage from "Features/mapEditor/utils/getPointerPositionInStage";

export default function getMapEditorBboxInStage(mapEditor) {
  const bbox = mapEditor.stage.container().getBoundingClientRect();

  const pointTL = getPointerPositionInStage(
    {x: bbox.left, y: bbox.top},
    mapEditor.stage
  );
  const pointBR = getPointerPositionInStage(
    {x: bbox.right, y: bbox.bottom},
    mapEditor.stage
  );

  return {
    x: pointTL.x,
    y: pointTL.y,
    width: pointBR.x - pointTL.x,
    height: pointBR.y - pointTL.y,
  };
}
