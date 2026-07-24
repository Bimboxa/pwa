import { Box } from "@mui/material";

import CardObject from "./CardObject";

export default function GridObjects({ objects, onOpen, onLocate }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 1.5,
      }}
    >
      {objects.map((object) => (
        <CardObject
          key={object.id}
          object={object}
          onOpen={onOpen}
          onLocate={onLocate}
        />
      ))}
    </Box>
  );
}
