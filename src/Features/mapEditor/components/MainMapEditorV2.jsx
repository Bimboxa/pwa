import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import SectionNoMap from "Features/mapEditor/components/SectionNoMap";
import MapEditorGeneric from "Features/mapEditorGeneric/components/MapEditorGeneric";
import LayerMapEditor from "./LayerMapEditor";

export default function MainMapEditorV2() {
  // data

  const mainBaseMap = useMainBaseMap();
  const { value: baseMaps } = useBaseMaps();
  const bgImage = useBgImageInMapEditor();

  const showBgImage = useSelector((s) => s.shower.showBgImage);

  // helpers

  const noBaseMaps = !baseMaps?.length > 0;

  // effects

  //useAutoSelectMainBaseMap();

  if (noBaseMaps) return <SectionNoMap />;

  // render

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
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
