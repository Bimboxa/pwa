import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import {
  Box,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { RotateRight } from "@mui/icons-material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";
import buildToolDraft from "../utils/buildToolDraft";
import { getDrawingToolByKey } from "../constants/drawingTools";

// "Axes de révolution" row of the "Outils de dessin" section.
//
// It is ORIENTATION-AWARE, because the axis has one authoring place and many
// instantiation places:
//   - on a HORIZONTAL base map (vue en plan) it offers the only thing that can
//     be done there — drawing a new axis (2 clicks: centre, then radius +
//     orientation),
//   - on a VERTICAL one it lists the axes already drawn on a plan; picking one
//     arms a single-click tool that drops it on the elevation AND poses that
//     base map in 3D.
//
// A separate component rather than a variant of `ToolRow`: ToolRow is built
// around `getDrawingToolsByType` returning DRAWING_TOOLS entries, whereas the
// vertical case lists ANNOTATIONS carrying a `revolutionAxisId` payload.
export default function ToolRowRevolutionAxis() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const isVertical = baseMap?.orientation === "VERTICAL";
  const revolutionAxes = useRevolutionAxes();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  // helpers

  const isActive = [
    "REVOLUTION_AXIS_PLAN",
    "REVOLUTION_AXIS_PLACEMENT",
  ].includes(enabledDrawingMode);

  const label = isVertical ? "Axes de révolution" : "Axe de révolution";

  // handlers

  function handleRowClick(e) {
    if (isVertical) {
      setMenuAnchor(e.currentTarget);
      return;
    }
    const tool = getDrawingToolByKey("REVOLUTION_AXIS_PLAN");
    if (!tool) return;
    dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
    dispatch(setNewAnnotation(buildToolDraft(newAnnotation, tool)));
  }

  function handleSelectAxis(axis) {
    setMenuAnchor(null);
    setIsHovered(false);
    const tool = getDrawingToolByKey("REVOLUTION_AXIS_PLACE");
    if (!tool) return;
    dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
    // `revolutionAxisId` must ride through buildToolDraft's clean-draft branch,
    // which otherwise wipes everything but the shape defaults.
    dispatch(
      setNewAnnotation(
        buildToolDraft(newAnnotation, tool, undefined, {
          revolutionAxisId: axis.id,
          label: axis.label,
        })
      )
    );
  }

  // render

  return (
    <Box>
      <ListItemButton
        onClick={handleRowClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!menuAnchor) setIsHovered(false);
        }}
        sx={{
          position: "relative",
          bgcolor: isActive ? "action.selected" : "white",
          alignItems: "center",
          justifyContent: "space-between",
          pl: 3,
          pr: 1,
          py: 0.5,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              mr: 1,
            }}
          >
            <RotateRight
              sx={{
                fontSize: 18,
                color: isHovered ? "panel.textSecondary" : "panel.textMuted",
              }}
            />
          </Box>
          <Typography
            variant="body2"
            sx={{ color: "panel.textSecondary", userSelect: "none" }}
          >
            {label}
          </Typography>
        </Box>
      </ListItemButton>

      {/* Vertical base map: pick which plan axis to drop here. */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => {
          setMenuAnchor(null);
          setIsHovered(false);
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 220,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        {revolutionAxes.length === 0 && (
          <MenuItem disabled dense>
            <ListItemText
              primaryTypographyProps={{ variant: "body2" }}
              secondaryTypographyProps={{ variant: "caption" }}
              primary="Aucun axe"
              secondary="Dessinez-en un sur une vue en plan"
            />
          </MenuItem>
        )}
        {revolutionAxes.map((axis) => (
          <MenuItem key={axis.id} dense onClick={() => handleSelectAxis(axis)}>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {axis.label ?? "Axe"}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
