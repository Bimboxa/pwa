import { Box } from "@mui/material";

import AdminSearchBar from "./AdminSearchBar";
import AdminColumnModels from "./AdminColumnModels";
import AdminColumnListings from "./AdminColumnListings";
import AdminColumnEntities from "./AdminColumnEntities";

export default function ViewerAdmin() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: 1,
        height: 1,
        bgcolor: "background.default",
      }}
    >
      <AdminSearchBar />
      <Box
        sx={{
          display: "flex",
          flexGrow: 1,
          minHeight: 0,
        }}
      >
        <AdminColumnModels />
        <AdminColumnListings />
        <AdminColumnEntities />
      </Box>
    </Box>
  );
}
