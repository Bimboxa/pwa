import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";

import { Box } from "@mui/material";

import SectionNoMap from "Features/mapEditor/components/SectionNoMap";
import MapEditorGeneric from "Features/mapEditorGeneric/components/MapEditorGeneric";
import LayerMapEditor from "./LayerMapEditor";

export default function MainMapEditorV2() {
  const dispatch = useDispatch();

  // data

  const mainBaseMap = useMainBaseMap();
  const { value: baseMaps } = useBaseMaps();
  const bgImage = useBgImageInMapEditor();

  const showBgImage = useSelector((s) => s.shower.showBgImage);

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers

  const noBaseMaps = !baseMaps?.length > 0;

  // effects

  //useAutoSelectMainBaseMap();

  if (noBaseMaps) return <SectionNoMap />;

  // handlers

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      if (enabledDrawingMode) {
        dispatch(setEnabledDrawingMode(null));
      }
    }
  }

  // render

  return (
    <Box
      onKeyDown={handleKeyDown}
      tabIndex={0}
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        outline: "none", // Remove focus outline since this is a container
      }}
    >
      <MapEditorGeneric
        baseMapImageUrl={mainBaseMap?.image.imageUrlClient}
        bgImageUrl={bgImage?.imageUrlRemote}
        showBgImage={showBgImage}
      />

      <LayerMapEditor />
    </Box>
  );
}
