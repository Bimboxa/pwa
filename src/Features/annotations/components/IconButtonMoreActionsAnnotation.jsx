import { useState } from "react";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import { IconButton, Menu, MenuItem } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";

import getFreeTextStyleDefaults from "Features/annotations/utils/getFreeTextStyleDefaults";

// strings

const resetStyleS = "Réinitialiser le style";

// "..." menu of the annotation properties panel header. Actions depend on
// the annotation type; renders nothing when the type has none.
export default function IconButtonMoreActionsAnnotation({ annotation }) {
  // data

  const updateAnnotation = useUpdateAnnotation();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const actions = [];

  if (annotation?.type === "FREE_TEXT") {
    actions.push({
      label: resetStyleS,
      handler: async () => {
        setAnchorEl(null);
        if (!annotation?.id) return;
        await updateAnnotation({
          id: annotation.id,
          ...getFreeTextStyleDefaults(),
        });
      },
    });
  }

  // handlers

  function handleClick(event) {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  // render

  if (actions.length === 0) return null;

  return (
    <>
      <IconButton onClick={handleClick}>
        <MoreActionsIcon />
      </IconButton>

      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        {actions.map((action) => (
          <MenuItem key={action.label} onClick={action.handler}>
            {action.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
