import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedDetailTemplateId } from "../resourcesSlice";

import {
  Box,
  Checkbox,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";

import useAnnotationTemplatesBySelectedListing from "Features/annotations/hooks/useAnnotationTemplatesBySelectedListing";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

// Bottom section of the resource PDF detail (MAP module only): pick the
// DETAIL annotationTemplate used when a page is drag-n-dropped on the 2D
// editor. Single selection rendered as checkboxes; kept in
// s.resources.selectedDetailTemplateId.
export default function SectionSelectDetailTemplate() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Modèle de détail";
  const helperS =
    "Utilisé à la création d'un détail par glisser-déposer d'une page sur le plan.";
  const noTemplateS = "Aucun modèle de détail dans la liste sélectionnée.";

  // data

  const templates = useAnnotationTemplatesBySelectedListing({
    sortByLabel: true,
  });
  const selectedDetailTemplateId = useSelector(
    (s) => s.resources.selectedDetailTemplateId
  );

  // helpers

  const detailTemplates = useMemo(
    () => (templates ?? []).filter((t) => resolveDrawingShape(t) === "DETAIL"),
    [templates]
  );

  // Keep the selection valid for the current listing: auto-select the first
  // DETAIL template when nothing (or a template of another listing) is
  // selected.
  const detailTemplateIdsKey = detailTemplates.map((t) => t.id).join(",");
  useEffect(() => {
    if (detailTemplates.length === 0) return;
    const stillValid = detailTemplates.some(
      (t) => t.id === selectedDetailTemplateId
    );
    if (!stillValid)
      dispatch(setSelectedDetailTemplateId(detailTemplates[0].id));
  }, [detailTemplateIdsKey, selectedDetailTemplateId]);

  // render

  return (
    <Box
      sx={{
        flexShrink: 0,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ px: 1, pt: 1 }}>
        <Typography variant="body2">{titleS}</Typography>
        <Typography variant="caption" color="text.secondary">
          {helperS}
        </Typography>
      </Box>

      {detailTemplates.length === 0 ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", px: 1, pb: 1, fontStyle: "italic" }}
        >
          {noTemplateS}
        </Typography>
      ) : (
        <List dense disablePadding sx={{ maxHeight: 150, overflowY: "auto" }}>
          {detailTemplates.map((template) => (
            <ListItemButton
              key={template.id}
              dense
              onClick={() => dispatch(setSelectedDetailTemplateId(template.id))}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Checkbox
                  edge="start"
                  size="small"
                  checked={template.id === selectedDetailTemplateId}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText
                primary={template.label}
                primaryTypographyProps={{ variant: "body2", noWrap: true }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
