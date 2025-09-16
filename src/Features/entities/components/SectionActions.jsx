import { createElement } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setOpenDialogDeleteEntity } from "../entitiesSlice";

import useEntitiesActions from "../hooks/useEntitiesActions";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useSelectedEntity from "../hooks/useSelectedEntity";

import { Box, IconButton } from "@mui/material";
import DialogDeleteEntity from "./DialogDeleteEntity";

export default function SectionActions() {
  const dispatch = useDispatch();

  // data

  const actions = useEntitiesActions();
  const { value: listing } = useSelectedListing();
  const openDialogDeleteEntity = useSelector(
    (s) => s.entities.openDialogDeleteEntity
  );
  const { value: entity } = useSelectedEntity();

  // helpers

  const color = listing?.color;
  console.log("debug_1609 color", color);

  return (
    <>
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

      <DialogDeleteEntity
        open={openDialogDeleteEntity}
        entity={entity}
        onClose={() => dispatch(setOpenDialogDeleteEntity(false))}
      />
    </>
  );
}
