import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import {
  Box,
  Button,
  Chip,
  IconButton,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Popper,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import ProcedurePopperContent from "Features/annotationsAuto/components/ProcedurePopperContent";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
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
// tool picker, the side button shows the ACTIVE axis (the one a row click will
// drop, first axis by default) and opens the full axis list; with no axis yet
// it reads "Aucun axe" and the menu explains how to create one. Dropping the
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
  dragListeners,
}) {
  const dispatch = useDispatch();
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  // data

  const revolutionAxes = useRevolutionAxes();
  const hasAxes = revolutionAxes.length > 0;

  // Linked ANNOTATIONS_CREATOR procedures (template procedureKeys) — the
  // "Auto" chip + popper, same as the standard row: launching from the
  // vertical map sources the placement's AXIS (see ProcedurePopperContent).
  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];
  const linkedProcedures = (annotationTemplate?.procedureKeys ?? [])
    .map((key) => procedures.find((p) => p.key === key))
    .filter(Boolean);
  const hasProcedure = linkedProcedures.length > 0;
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [axesMenuAnchor, setAxesMenuAnchor] = useState(null);
  const [activeAxisId, setActiveAxisId] = useState(null);
  const [procedureAnchorEl, setProcedureAnchorEl] = useState(null);
  const procedurePopperCloseTimer = useRef(null);
  const procedurePopperRef = useRef(null);
  const procedurePopperHoveredRef = useRef(false);

  // Keep the procedure popper open while hovering the chip OR the popper
  // itself, with a small close delay to bridge the gap (same contract as the
  // standard row). It also survives a focused parameter field.
  const openProcedurePopper = (e) => {
    if (procedurePopperCloseTimer.current)
      clearTimeout(procedurePopperCloseTimer.current);
    setProcedureAnchorEl(e.currentTarget);
  };
  const cancelCloseProcedurePopper = () => {
    procedurePopperHoveredRef.current = true;
    if (procedurePopperCloseTimer.current)
      clearTimeout(procedurePopperCloseTimer.current);
  };
  const scheduleCloseProcedurePopper = () => {
    procedurePopperHoveredRef.current = false;
    if (procedurePopperCloseTimer.current)
      clearTimeout(procedurePopperCloseTimer.current);
    procedurePopperCloseTimer.current = setTimeout(() => {
      if (procedurePopperRef.current?.contains(document.activeElement)) return;
      setProcedureAnchorEl(null);
    }, 150);
  };
  const handleProcedurePopperBlur = () => {
    if (!procedurePopperHoveredRef.current) scheduleCloseProcedurePopper();
  };

  // helpers

  const isHidden = annotationTemplate?.hidden;
  const templateColor =
    annotationTemplate?.fillColor ??
    annotationTemplate?.strokeColor ??
    "#1976d2";
  const activeAxis =
    revolutionAxes.find((a) => a.id === activeAxisId) ?? revolutionAxes[0];
  const axisBtnLabel = hasAxes ? (activeAxis?.label ?? "Axe") : "Aucun axe";

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
    armAxis(activeAxis);
  };

  const handleAxesBtnClick = (e) => {
    e.stopPropagation();
    setAxesMenuAnchor(e.currentTarget);
  };

  const handleSelectAxis = (axis) => {
    setActiveAxisId(axis.id);
    armAxis(axis);
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
        {/* Drag handle */}
        <Box
          {...(dragListeners ?? {})}
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "grab",
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.15s",
            mr: 0.5,
            flexShrink: 0,
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 16, color: "panel.textLight" }} />
        </Box>
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
            color={isHidden || !hasAxes ? "text.disabled" : "panel.textPrimary"}
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

          {hasProcedure && (
            <Chip
              label="Auto"
              size="small"
              onMouseEnter={openProcedurePopper}
              onMouseLeave={scheduleCloseProcedurePopper}
              sx={{
                ml: 0.5,
                flexShrink: 0,
                height: 16,
                "& .MuiChip-label": {
                  px: 0.5,
                  fontSize: "9px",
                  fontWeight: "bold",
                },
              }}
            />
          )}
        </Box>

        {hasProcedure && (
          <Popper
            open={Boolean(procedureAnchorEl)}
            anchorEl={procedureAnchorEl}
            placement="bottom-start"
            style={{ zIndex: 2000 }}
            modifiers={[{ name: "offset", options: { offset: [0, 4] } }]}
          >
            {/* Portaled but a React child of the row's ListItemButton:
                without stopping propagation, clicking a launcher button would
                bubble to handleRowClick and arm the placement tool. */}
            <Box
              ref={procedurePopperRef}
              onMouseEnter={cancelCloseProcedurePopper}
              onMouseLeave={scheduleCloseProcedurePopper}
              onBlurCapture={handleProcedurePopperBlur}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <ProcedurePopperContent
                procedures={linkedProcedures}
                sourceTemplate={annotationTemplate}
                baseMapId={selectedBaseMapId}
              />
            </Box>
          </Popper>
        )}

        {/* Right side: active axis button + visibility (hover) OR qty */}
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
              {/* Active axis button — replaces the tool picker of the
                  standard row */}
              <Tooltip title="Choisir l'axe" arrow>
                <Button
                  size="small"
                  onClick={handleAxesBtnClick}
                  sx={{
                    px: 0.75,
                    py: 0.25,
                    minWidth: 0,
                    fontSize: "11px",
                    lineHeight: 1.4,
                    textTransform: "none",
                    whiteSpace: "nowrap",
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
                  {axisBtnLabel}
                </Button>
              </Tooltip>
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
        {!hasAxes && (
          <MenuItem disabled dense>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              Créer d&apos;abord un axe sur un fond de plan horizontal
            </ListItemText>
          </MenuItem>
        )}
        {revolutionAxes.map((axis) => (
          <MenuItem
            key={axis.id}
            dense
            selected={axis.id === activeAxis?.id}
            onClick={() => handleSelectAxis(axis)}
          >
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {axis.label ?? "Axe"}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
