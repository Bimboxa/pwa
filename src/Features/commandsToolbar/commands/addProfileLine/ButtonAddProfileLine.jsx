import { useState } from "react";

import { setSubSelection } from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";

import applyProfileFromAnnotationService from "Features/elevation/services/applyProfileFromAnnotationService";
import listProfileAnnotations from "Features/annotations/utils/listProfileAnnotations";

import CommandButton from "../../components/CommandButton";

const DRAW_LABEL = "Dessiner un profil";
const EXISTING_LABEL = "Profils existants";
const POLYLINE_ONLY = "Réservé aux lignes";
const EMPTY_LABEL =
  "Aucune annotation « Profil » — activez le switch Profil dans les propriétés d'une annotation.";

// Button of « Ajouter un profil » (commandsToolbar): an intermediate menu —
// draw the profile (the ADD_PROFILE_LINE drawing mode, `command.run`) or
// apply an existing annotation flagged « Profil » (applyProfileFromAnnotation
// Service, POLYLINE hosts only — the service's contract). The menu anchors on
// the `anchor` argument (the group button inside a group menu, which is
// keepMounted, so the menu survives its closing). While the drawing mode is
// armed, the click disarms it directly (no menu).
export default function ButtonAddProfileLine({
  command,
  ctx,
  deps,
  state,
  hotkeyLabel,
}) {
  // data

  const selected = ctx.selectedAnnotation;
  const isPolylineHost = selected?.type === "POLYLINE";
  const armed = ctx.enabledDrawingMode === "ADD_PROFILE_LINE";

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [items, setItems] = useState(null); // null = loading
  const open = Boolean(anchorEl);

  // handlers

  async function handleClick(event, anchor) {
    if (armed) {
      command.run(ctx, deps);
      return;
    }
    setAnchorEl(anchor);
    setItems(null);
    const projectId =
      selected?.projectId ?? deps.store.getState().projects.selectedProjectId;
    setItems(
      await listProfileAnnotations({
        projectId,
        excludeAnnotationId: selected?.id,
      })
    );
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleDraw() {
    handleClose();
    command.run(ctx, deps);
  }

  async function handleApply(sourceAnnotationId) {
    handleClose();
    if (!selected?.id) return;
    const idx = await applyProfileFromAnnotationService({
      annotationId: selected.id,
      sourceAnnotationId,
      seedSegmentIndex: 0,
      dispatch: deps.dispatch,
    });
    if (!Number.isInteger(idx)) {
      deps.dispatch(
        setToaster({
          message: "Profil non appliqué (géométrie insuffisante)",
          severity: "warning",
        })
      );
      return;
    }
    // Sub-select the new profile line so the toolbar switches to its row and
    // the Élévation panel targets it (same as the drawn commit).
    deps.dispatch(
      setSubSelection({
        partId: `${selected.id}::PROFILE_LINE::${idx}`,
        partType: "PROFILE_LINE",
      })
    );
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={{ ...state, active: state.active || open }}
        onClick={handleClick}
      />
      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <MenuItem dense onClick={handleDraw}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <command.Icon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText primary={DRAW_LABEL} />
        </MenuItem>
        <Divider />
        <ListSubheader sx={{ lineHeight: "28px" }}>
          {EXISTING_LABEL}
        </ListSubheader>
        {items === null && (
          <MenuItem dense disabled>
            <Typography variant="body2" color="text.secondary">
              Chargement…
            </Typography>
          </MenuItem>
        )}
        {items?.length === 0 && (
          <MenuItem dense disabled sx={{ whiteSpace: "normal", maxWidth: 320 }}>
            <Typography variant="body2" color="text.secondary">
              {EMPTY_LABEL}
            </Typography>
          </MenuItem>
        )}
        {(items ?? []).map((it) => (
          <MenuItem
            key={it.id}
            dense
            disabled={!isPolylineHost}
            onClick={() => handleApply(it.id)}
          >
            <ListItemText
              primary={it.label}
              secondary={isPolylineHost ? undefined : POLYLINE_ONLY}
              primaryTypographyProps={{ variant: "body2" }}
              secondaryTypographyProps={{ variant: "caption" }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
