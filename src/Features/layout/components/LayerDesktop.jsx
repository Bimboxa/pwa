import { Box } from "@mui/material";
import MenuListTypes from "Features/listPanel/components/MenuListTypes";
import TopBarProjectAndScope from "./TopBarProjectAndScope";
import SelectorViewer from "Features/viewers/components/SelectorViewer";

export default function LayerDesktop() {
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 2,
        }}
      >
        <TopBarProjectAndScope />
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: "8px",
          right: "8px",
          zIndex: 2,
        }}
      >
        <SelectorViewer />
      </Box>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "8px",
          transform: "translateY(-50%)",
          zIndex: 2,
        }}
      >
        <MenuListTypes />
      </Box>
    </>
  );
}
