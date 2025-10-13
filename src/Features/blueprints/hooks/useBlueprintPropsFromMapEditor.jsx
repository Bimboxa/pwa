import { useSelector } from "react-redux";

export default function useBlueprintPropsFromMapEditor() {
  // data

  const baseMapPoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const bgImageKey = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);
  const legendFormat = useSelector((s) => s.mapEditor.legendFormat);
  const bgImageRawTextAnnotations = useSelector(
    (s) => s.mapEditor.bgImageRawTextAnnotations
  );

  // return

  return {
    baseMapId,
    baseMapPoseInBg,
    bgImageKey,
    legendFormat,
    bgImageRawTextAnnotations,
  };
}
