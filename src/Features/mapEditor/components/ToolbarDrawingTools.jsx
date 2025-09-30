import useSelectedEntityModel from "Features/listings/hooks/useSelectedEntityModel";

import ButtonDrawMarker from "./ButtonDrawMarker";
import ButtonDrawPolylineV2 from "./ButtonDrawPolylineV2";

import { Box } from "@mui/material";

export default function ToolbarDrawingTools() {
  // data

  const em = useSelectedEntityModel();

  // helpers

  const type = em?.type;

  return (
    <Box
      sx={{
        display: type === "LOCATED_ENTITY" ? "flex" : "none",
        alignItems: "center",
        gap: 1,
        color: "action.active",
      }}
    >
      <ButtonDrawMarker />
      <ButtonDrawPolylineV2 />
    </Box>
  );
}
