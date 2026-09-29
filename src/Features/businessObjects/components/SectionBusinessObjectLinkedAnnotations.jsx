import { useDispatch } from "react-redux";

import {
  setSelectedMainBaseMapId,
  setZoomTo,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { AddLink, LinkOff } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

// "Annotations liées" section of the business object properties panel, for
// the types without quantities (issues): the picking-mode toggle and the
// flat list of the linked annotations — the other types get both in their
// "Quantités" tab. A row click opens the annotation's base map, zooms on the
// annotation and selects it; the hover button removes the link.
// `rows`: [{annotation, rel}], computed by the panel.
export default function SectionBusinessObjectLinkedAnnotations({
  rows,
  annotationTemplateById,
  baseMapNameById,
  spriteImage,
  isLinking,
  onToggleLinking,
  onUnlink,
  emptyLabel,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Annotations liées";
  const linkingOnS = "Quitter le mode liaison (Échap)";
  const linkingOffS = "Mode liaison";
  const baseMapS = "Plan";
  const unlinkS = "Délier cette annotation";

  // handlers

  function handleSelectAnnotation(annotation) {
    if (annotation.baseMapId)
      dispatch(setSelectedMainBaseMapId(annotation.baseMapId));
    if (annotation.points?.length > 0) {
      dispatch(setZoomTo(annotation.points[0]));
    } else if (annotation.x != null) {
      dispatch(setZoomTo({ x: annotation.x, y: annotation.y }));
    }
    dispatch(
      setSelectedItem({
        id: annotation.id,
        nodeId: annotation.id,
        type: "NODE",
        nodeType: "ANNOTATION",
        listingId: annotation.listingId,
      })
    );
  }

  function handleUnlink(e, rel) {
    e.stopPropagation();
    onUnlink(rel);
  }

  // render

  return (
    <>
      <Box sx={{ p: 1, borderTop: "1px solid", borderColor: "divider" }}>
        <Button
          size="small"
          variant={isLinking ? "contained" : "outlined"}
          fullWidth
          onClick={onToggleLinking}
          startIcon={<AddLink fontSize="small" />}
        >
          {isLinking ? linkingOnS : linkingOffS}
        </Button>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
          bgcolor: "panel.sectionBg",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {titleS}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {rows.length}
        </Typography>
      </Box>
      {rows.length === 0 ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", px: 1.5, py: 1 }}
        >
          {emptyLabel}
        </Typography>
      ) : (
        <List dense disablePadding>
          {rows.map(({ annotation, rel }) => {
            const template =
              annotationTemplateById[annotation.annotationTemplateId];
            return (
              <ListItemButton
                key={annotation.id}
                onClick={() => handleSelectAnnotation(annotation)}
                sx={{
                  py: 0.25,
                  "&:hover .business-object-unlink": {
                    visibility: "visible",
                  },
                }}
              >
                <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                  <AnnotationTemplateIcon
                    template={template}
                    size={20}
                    spriteImage={spriteImage}
                  />
                </Box>
                <ListItemText
                  primary={
                    annotation.label || template?.label || annotation.type
                  }
                  secondary={baseMapNameById[annotation.baseMapId] || baseMapS}
                  slotProps={{
                    primary: { variant: "body2", noWrap: true },
                    secondary: { variant: "caption", noWrap: true },
                  }}
                />
                <IconButton
                  className="business-object-unlink"
                  size="small"
                  onClick={(e) => handleUnlink(e, rel)}
                  title={unlinkS}
                  sx={{ ml: 0.5, visibility: "hidden" }}
                >
                  <LinkOff sx={{ fontSize: 16 }} />
                </IconButton>
              </ListItemButton>
            );
          })}
        </List>
      )}
    </>
  );
}
