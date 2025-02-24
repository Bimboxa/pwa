export default function getStagePositionAndScaleFromImageSize(
  stage,
  imageSize
) {
  // edge case
  if (!stage || !imageSize) return {x: 0, y: 0, scale: 1};

  // main
  const bbox = stage.container().getBoundingClientRect();

  const stageRatio = bbox.width / bbox.height;
  const imagesRatio = imageSize.width / imageSize.height;

  const centerImageAxis = stageRatio > imagesRatio ? "x" : "y";

  const scale =
    stageRatio > imagesRatio
      ? bbox.height / imageSize.height
      : bbox.width / imageSize.width;

  return {
    x: centerImageAxis === "x" ? (bbox.width - imageSize.width * scale) / 2 : 0,
    y:
      centerImageAxis === "y"
        ? (bbox.height - imageSize.height * scale) / 2
        : 0,
    scale,
  };
}
