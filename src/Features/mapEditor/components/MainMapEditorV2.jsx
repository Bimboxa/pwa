import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";

import { Box } from "@mui/material";

import SectionNoMap from "Features/mapEditor/components/SectionNoMap";
import MapEditorGeneric from "Features/mapEditorGeneric/components/MapEditorGeneric";
import LayerMapEditor from "./LayerMapEditor";

export default function MainMapEditorV2() {
  // data

  const mainBaseMap = useMainBaseMap();
  const bgImage = useBgImageInMapEditor();

  // effects

  //useAutoSelectMainBaseMap();

  //if (!mainBaseMap) return <SectionNoMap />;

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
      />

      <LayerMapEditor />
    </Box>
  );
}
