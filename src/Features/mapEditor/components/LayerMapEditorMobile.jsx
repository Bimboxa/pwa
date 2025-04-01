import {Box} from "@mui/material";

//import ToolbarMapEditor from "./ToolbarMapEditor";
// import SelectorMapInMapEditor from "Features/maps/components/SelectorMapInMapEditor";
import ButtonSelectorMap from "Features/maps/components/ButtonSelectorMap";

export default function LayerMapEditorMobile() {
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          bottom: "8px",
          transform: "translateX(-50%)",
          zIndex: 1,
        }}
      >
        <ButtonSelectorMap />
      </Box>

      {/* <Box
        sx={{
          position: "absolute",
          bottom: "8px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1,
        }}
      >
        <ToolbarMapEditor />
      </Box> */}
    </>
  );
}
