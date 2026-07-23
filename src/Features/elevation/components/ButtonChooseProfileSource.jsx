import { useState } from "react";

import { Button, Menu, MenuItem, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import db from "App/db/db";

// Bottom-bar button of the elevation section editor: opens the list of the
// project's annotations flagged `isProfile` (see the Propriétés panel switch)
// and applies the picked one as the edited profile's source. The list is
// fetched on open (transient menu — no live query needed).
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
    const all = await db.annotations
      .filter(
        (a) =>
          Boolean(a.isProfile) &&
          !a.deletedAt &&
          a.id !== annotationId &&
          (!ann?.projectId || a.projectId === ann.projectId)
      )
      .toArray();
    // fallback labels from the annotation templates
    const templateIds = [
      ...new Set(all.map((a) => a.annotationTemplateId).filter(Boolean)),
    ];
    const templates = templateIds.length
      ? await db.annotationTemplates.bulkGet(templateIds)
      : [];
    const templateById = new Map(
      templates.filter(Boolean).map((t) => [t.id, t])
    );
    setItems(
      all.map((a) => ({
        id: a.id,
        label:
          a.label ||
          templateById.get(a.annotationTemplateId)?.label ||
          "Sans nom",
      }))
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
