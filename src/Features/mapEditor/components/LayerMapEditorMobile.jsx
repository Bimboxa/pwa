import { Box } from "@mui/material";

//import ToolbarMapEditor from "./ToolbarMapEditor";
// import SelectorMapInMapEditor from "Features/baseMaps/components/SelectorMapInMapEditor";
import IconButtonListingSelector from "Features/listings/components/IconButtonListingSelector";
import ButtonSelectorBaseMapInMapEditor from "Features/baseMaps/components/ButtonSelectorBaseMapInMapEditor";

export default function LayerMapEditorMobile() {
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          top: "16px",
          left: "16px",
          //transform: "translateX(-50%)",
          zIndex: 1,
        }}
      >
        <IconButtonListingSelector />
      </Box>
      {/* <Box
        sx={{
          position: "absolute",
          left: "50%",
          bottom: "16px",
          transform: "translateX(-50%)",
          zIndex: 1,
        }}
      >
        <ButtonSelectorBaseMapInMapEditor />
      </Box> */}

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
