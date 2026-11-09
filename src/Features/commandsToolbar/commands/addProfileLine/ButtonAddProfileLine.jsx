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
import { EDITOR_3D } from "../../constants/commandEditors";

const DRAW_LABEL = "Dessiner un profil";
const EXISTING_LABEL = "Profils existants";
const POLYLINE_ONLY = "Réservé aux lignes";
const EMPTY_LABEL =
  "Aucune annotation « Profil » — activez le switch Profil dans les propriétés d'une annotation.";

// Button of « Ajouter un profil » (commandsToolbar): an intermediate menu —
// draw the profile (the ADD_PROFILE_LINE drawing mode, `command.run`, 2D
// editor only) or apply an existing annotation flagged « Profil »
// (applyProfileFromAnnotationService, POLYLINE hosts only — the service's
// contract). The menu anchors on the `anchor` argument (the group button
// inside a group menu, which is keepMounted, so the menu survives its
// closing; the slot's own button otherwise). While the drawing mode is
// armed, the click disarms it directly (no menu). The same profiles are
// also offered as tiles by the « Forme par défaut » chip of
// ToolbarEditAnnotation(s) (Shape3DSelector / Shape3DBatchSelector).
//
// In the 3D editor only the existing profiles are offered: the applied line
// is read by the 3D build right away, and the host annotation stays selected
// (no PROFILE_LINE sub-selection — the 3D view has no part for it) so the
// « Profils » row of ToolbarEditAnnotation shows up at once.
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
  const is3d = ctx.editor === EDITOR_3D;
  const armed = !is3d && ctx.enabledDrawingMode === "ADD_PROFILE_LINE";

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
    if (is3d) return;
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
        {!is3d && (
          <MenuItem dense onClick={handleDraw}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <command.Icon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText primary={DRAW_LABEL} />
          </MenuItem>
        )}
        {!is3d && <Divider />}
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
