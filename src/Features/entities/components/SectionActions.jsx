import { createElement } from "react";

import useEntitiesActions from "../hooks/useEntitiesActions";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box, IconButton } from "@mui/material";

export default function SectionActions() {
  // data

  const actions = useEntitiesActions();
  const { value: listing } = useSelectedListing();

  // helpers

  const color = listing?.color;
  console.log("debug_1609 color", color);

  return (
    <Box sx={{ width: 1, p: 1 }}>
      {actions.map((action) => {
        return (
          <IconButton
            key={action.label}
            onClick={action.handler}
            disabled={action.disabled}
            sx={{ color }}
          >
            {createElement(action.icon, { color: "inherit" })}
          </IconButton>
        );
      })}
    </Box>
  );
}
