import { useDispatch } from "react-redux";

import { setBaseMapPoseInBg } from "../mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";

import getDefaultBaseMapPoseInBg from "../utils/getDefaultBaseMapPoseInBg";

export default function useResetBaseMapPose() {
  const dispatch = useDispatch();

  // data

  const mainBaseMap = useMainBaseMap();
  const bgImage = useBgImageInMapEditor();

  // handlers

  const reset = async () => {
    const baseMapUrl = mainBaseMap.image.imageUrlClient;
    const bgUrl = bgImage.url;
    const bbox = bgImage.bbox;
    const defaultBaseMapPoseInBg = await getDefaultBaseMapPoseInBg({
      baseMapUrl,
      bgUrl,
      bbox,
    });
    dispatch(setBaseMapPoseInBg(defaultBaseMapPoseInBg));
  };

  return reset;
}
