import { useState } from "react";

import { Button, Menu, MenuItem, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import db from "App/db/db";
import listProfileAnnotations from "Features/annotations/utils/listProfileAnnotations";

// Bottom-bar button of the elevation section editor: opens the list of the
// project's annotations flagged `isProfile` (see the Propriétés panel switch,
// listProfileAnnotations) and applies the picked one as the edited profile's
// source. The list is fetched on open (transient menu — no live query needed).
export default function ButtonChooseProfileSource({
  annotationId,
  onSelectSource,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [items, setItems] = useState(null); // null = loading

  // handlers

  async function handleOpen(e) {
    setAnchorEl(e.currentTarget);
    setItems(null);
    const ann = await db.annotations.get(annotationId);
    setItems(
      await listProfileAnnotations({
        projectId: ann?.projectId,
        excludeAnnotationId: annotationId,
      })
    );
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleSelect(id) {
    setAnchorEl(null);
    onSelectSource?.(id);
  }

  // render

  return (
    <>
      <Button
        size="small"
        variant="contained"
        color="inherit"
        endIcon={<ExpandMoreIcon />}
        onClick={handleOpen}
        sx={{ bgcolor: "background.paper", textTransform: "none" }}
      >
        Choisir un profil
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        {items?.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              Aucune annotation « Profil » — activez le switch Profil dans les
              propriétés d&apos;une annotation.
            </Typography>
          </MenuItem>
        )}
        {(items ?? []).map((it) => (
          <MenuItem key={it.id} onClick={() => handleSelect(it.id)}>
            <Typography variant="body2">{it.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
