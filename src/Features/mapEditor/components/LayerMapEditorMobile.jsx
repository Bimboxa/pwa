import {Box} from "@mui/material";

//import ToolbarMapEditor from "./ToolbarMapEditor";
// import SelectorMapInMapEditor from "Features/maps/components/SelectorMapInMapEditor";
import IconButtonListingSelector from "Features/listings/components/IconButtonListingSelector";
import ButtonSelectorMap from "Features/maps/components/ButtonSelectorMap";

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
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          bottom: "16px",
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
