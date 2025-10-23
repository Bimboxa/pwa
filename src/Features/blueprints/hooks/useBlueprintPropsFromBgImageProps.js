import { useSelector } from "react-redux";

export default function useBlueprintPropsFromBgImageProps() {
  const baseMapPoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMapGrayScale = useSelector((s) => s.mapEditor.baseMapGrayScale);
  const baseMapOpacity = useSelector((s) => s.mapEditor.baseMapOpacity);

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const bgImageKey = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);
  const legendFormat = useSelector((s) => s.mapEditor.legendFormat);
  const bgImageRawTextAnnotations = useSelector(
    (s) => s.bgImage.bgImageRawTextAnnotations
  );

  const props = {
    baseMapPoseInBg,
    baseMapGrayScale,
    baseMapOpacity,
    baseMapId,
    bgImageKey,
    legendFormat,
    bgImageRawTextAnnotations,
  };

  return props;
}
