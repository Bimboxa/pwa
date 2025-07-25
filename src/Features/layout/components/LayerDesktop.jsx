import { Box } from "@mui/material";
import MenuListTypes from "Features/listPanel/components/MenuListTypes";

export default function LayerDesktop() {
  return (
    <>
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
