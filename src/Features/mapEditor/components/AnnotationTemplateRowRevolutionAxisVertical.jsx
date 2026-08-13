import { useState } from "react";
import { useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import {
  Box,
  IconButton,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  RotateRight,
  Tune,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";

// REVOLUTION_AXIS template row shown on a VERTICAL base map (DRAW mode only —
// the standard AnnotationTemplateRow renders in the other modes).
//
// An axis has one authoring place and many instantiation places: it is drawn
// on a HORIZONTAL plan from the standard template row, whereas on an elevation
// the same template row can only DROP an already-drawn axis. So instead of the
// tool picker, this row arms the one-click placement tool: clicking the row
// picks the first axis, the side button opens the full axis list. Dropping the
// placement also poses the vertical base map in 3D (see
// computeVerticalBaseMapPlacementFromAxis).
export default function AnnotationTemplateRowRevolutionAxisVertical({
  annotationTemplate,
  count,
  qtyLabel,
  listingId,
  spriteImage,
  sortableRef,
  sortableStyle,
  sortableAttributes,
}) {
  const dispatch = useDispatch();
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  // data

  const revolutionAxes = useRevolutionAxes();
  const hasAxes = revolutionAxes.length > 0;

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [axesMenuAnchor, setAxesMenuAnchor] = useState(null);

  // helpers

  const isHidden = annotationTemplate?.hidden;
  const templateColor =
    annotationTemplate?.fillColor ??
    annotationTemplate?.strokeColor ??
    "#1976d2";

  // handlers

  const armAxis = (axis) => {
    setAxesMenuAnchor(null);
    setIsHovered(false);
    if (!axis) return;
    const tool = getDrawingToolByKey("REVOLUTION_AXIS_PLACE");
    if (!tool) return;
    dispatch(setSelectedListingId(listingId));
    const baseProps =
      getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate);
    // The template resolves to the AXIS shape: its geometry scalars must not
    // leak onto the placement record (a placement is just a point + style).
    for (const key of [
      "radiusM",
      "directionDeg",
      "invertHalf",
      "partialRevolution",
      "offsetZ",
      "height",
    ]) {
      delete baseProps[key];
    }
    // The placement label is the AXIS name, not the template name leaked into
    // the draft by ALWAYS_COPY_KEYS.
    dispatch(
      setNewAnnotation({
        ...baseProps,
        type: tool.annotationType,
        revolutionAxisId: axis.id,
        label: axis.label,
      })
    );
    dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
  };

  const handleRowClick = () => {
    if (!hasAxes) return;
    armAxis(revolutionAxes[0]);
  };

  const handleAxesBtnClick = (e) => {
    e.stopPropagation();
    setAxesMenuAnchor(e.currentTarget);
  };

  const handleEditTemplate = () => {
    dispatch(setSelectedListingId(listingId));
    dispatch(
      setSelectedItem({
        id: annotationTemplate?.id,
        type: "ANNOTATION_TEMPLATE",
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };

  const handleToggleHidden = async (e) => {
    e.stopPropagation();
    await updateAnnotationTemplate({
      ...annotationTemplate,
      hidden: !annotationTemplate?.hidden,
    });
  };

  // render

  return (
    <Box
      ref={sortableRef}
      style={sortableStyle}
      {...(sortableAttributes ?? {})}
    >
      <Tooltip
        title={
          hasAxes ? "" : "Commencez par créer un axe sur un plan horizontal"
        }
        arrow
        placement="bottom"
      >
        <ListItemButton
          onClick={handleRowClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            if (!axesMenuAnchor) setIsHovered(false);
          }}
          sx={{
            position: "relative",
            bgcolor: "white",
            alignItems: "center",
            justifyContent: "space-between",
            pl: 1,
            pr: 1,
            py: 0.5,
            borderLeft: "3px solid",
            borderColor: isHovered && hasAxes ? templateColor : "transparent",
            cursor: hasAxes ? "pointer" : "default",
            "&:hover": {
              bgcolor: hasAxes ? alpha(templateColor, 0.1) : "white",
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                mr: 1,
                flexShrink: 0,
                opacity: isHidden || !hasAxes ? 0.4 : 1,
                filter: isHidden ? "grayscale(100%)" : "none",
              }}
            >
              <AnnotationTemplateIcon
                template={annotationTemplate}
                size={18}
                spriteImage={spriteImage}
              />
            </Box>
            <Typography
              variant="body2"
              color={
                isHidden || !hasAxes ? "text.disabled" : "panel.textPrimary"
              }
              sx={{
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                userSelect: "none",
              }}
            >
              {annotationTemplate.label}
            </Typography>
          </Box>

          {/* Right side: properties + axis picker + visibility (hover) OR qty */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 0.5,
              ml: 1,
              minWidth: 56,
              flexShrink: 0,
            }}
          >
            {isHovered ? (
              <>
                <Tooltip title="Propriétés" arrow placement="bottom">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditTemplate();
                    }}
                    sx={{ p: 0.25, color: templateColor }}
                  >
                    <Tune sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                {/* Axis picker button — replaces the tool picker of the
                    standard row */}
                {hasAxes && (
                  <Tooltip title="Choisir l'axe" arrow>
                    <IconButton
                      size="small"
                      onClick={handleAxesBtnClick}
                      sx={{
                        p: 0.5,
                        bgcolor: axesMenuAnchor
                          ? templateColor
                          : alpha(templateColor, 0.15),
                        color: axesMenuAnchor ? "white" : templateColor,
                        borderRadius: 1,
                        "&:hover": {
                          bgcolor: templateColor,
                          color: "white",
                        },
                      }}
                    >
                      <RotateRight sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip
                  title={isHidden ? "Afficher" : "Masquer"}
                  arrow
                  placement="right"
                >
                  <IconButton
                    size="small"
                    onClick={handleToggleHidden}
                    sx={{
                      p: 0.5,
                      color: isHidden ? "secondary.main" : "panel.iconMuted",
                    }}
                  >
                    {isHidden ? (
                      <VisibilityOff fontSize="inherit" sx={{ fontSize: 16 }} />
                    ) : (
                      <Visibility fontSize="inherit" sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <Typography
                align="right"
                noWrap
                sx={{
                  fontSize: "10px",
                  minWidth: "40px",
                  fontFamily: "monospace",
                  fontWeight: 500,
                }}
                color={
                  isHidden
                    ? "text.disabled"
                    : count > 0
                      ? "secondary.main"
                      : "panel.countEmpty"
                }
              >
                {qtyLabel}
              </Typography>
            )}
          </Box>
        </ListItemButton>
      </Tooltip>

      {/* Axis picker menu */}
      <Menu
        anchorEl={axesMenuAnchor}
        open={Boolean(axesMenuAnchor)}
        onClose={() => {
          setAxesMenuAnchor(null);
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
        {revolutionAxes.map((axis) => (
          <MenuItem key={axis.id} dense onClick={() => armAxis(axis)}>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {axis.label ?? "Axe"}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
