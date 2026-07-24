import { Box } from "@mui/material";

import ListItemObject from "./ListItemObject";

export default function ListObjects({ objects, onOpen, onLocate }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {objects.map((object) => (
        <ListItemObject
          key={object.id}
          object={object}
          onOpen={onOpen}
          onLocate={onLocate}
        />
      ))}
    </Box>
  );
}
