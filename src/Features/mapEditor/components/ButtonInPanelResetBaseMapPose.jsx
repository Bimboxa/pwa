import { useDispatch } from "react-redux";

import { setBaseMapPoseInBg } from "../mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";

import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import getDefaultBaseMapPoseInBg from "../utils/getDefaultBaseMapPoseInBg";

export default function ButtonInPanelResetBaseMapPose() {
  const dispatch = useDispatch();
  // label

  const label = "Réinitialiser la position";

  // data

  const mainBaseMap = useMainBaseMap();
  const bgImage = useBgImageInMapEditor();

  // handlers

  async function handleClick() {
    const baseMapUrl = mainBaseMap.image.imageUrlClient;
    const bgUrl = bgImage.url;
    const bbox = bgImage.bbox;
    const defaultBaseMapPoseInBg = await getDefaultBaseMapPoseInBg({
      baseMapUrl,
      bgUrl,
      bbox,
    });
    dispatch(setBaseMapPoseInBg(defaultBaseMapPoseInBg));
  }

  return <ButtonInPanelV2 label={label} onClick={handleClick} />;
}
