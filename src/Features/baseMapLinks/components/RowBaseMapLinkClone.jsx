import { useState } from "react";
import { useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import {
  setNewAnnotation,
  triggerAnnotationsUpdate,
} from "Features/annotations/annotationsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  IconButton,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Replay, Visibility, VisibilityOff } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";

import db from "App/db/db";

// One row of the "Coupes / élévations liées" section of PopperMapListings,
// shown on a VERTICAL base map for each BASE_MAP_LINK section mark that
// targets it. Modelled on AnnotationTemplateRowRevolutionAxisVertical.
//
// States:
//   - no clone yet: the row is a DRAW entry — click arms the 2-click segment
//     that creates the clone (sourceLinkAnnotationId = the plan link);
//   - clone drawn: click selects it; hover shows the eye (record-level
//     `hidden` of the CLONE only) and "Repositionner" (delete + redraw).
//     A second clone can never be armed from the row.
export default function RowBaseMapLinkClone({
  link,
  clone,
  template,
  planBaseMap,
  spriteImage,
}) {
  const dispatch = useDispatch();
  const deleteAnnotations = useDeleteAnnotations();

  // strings

  const drawS = "Dessiner la coupe sur ce fond de plan";
  const selectS = "Sélectionner la coupe";
  const repositionS = "Repositionner";
  const showS = "Afficher";
  const hideS = "Masquer";

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const hasClone = Boolean(clone);
  const isHidden = Boolean(clone?.hidden);
  const color =
    link?.strokeColor ??
    template?.strokeColor ??
    template?.fillColor ??
    "#1976d2";
  const label = [template?.label ?? link?.label, planBaseMap?.name]
    .filter(Boolean)
    .join(" · ");

  // handlers

  const armClone = () => {
    setIsHovered(false);
    const tool = getDrawingToolByKey("BASE_MAP_LINK_SEGMENT");
    if (!tool || !link) return;
    if (link.listingId) dispatch(setSelectedListingId(link.listingId));
    const baseProps = template
      ? getNewAnnotationPropsFromAnnotationTemplate(template)
      : {
          listingId: link.listingId,
          annotationTemplateId: link.annotationTemplateId,
          strokeColor: link.strokeColor,
          strokeWidth: link.strokeWidth,
          strokeWidthUnit: link.strokeWidthUnit,
          strokeOpacity: link.strokeOpacity,
        };
    // The clone mirrors the plan link: same label, same style, and NO target
    // of its own (linkedBaseMapId lives on the source only).
    dispatch(
      setNewAnnotation({
        ...baseProps,
        type: tool.annotationType,
        label: link.label ?? baseProps.label,
        sourceLinkAnnotationId: link.id,
        linkedBaseMapId: undefined,
      })
    );
    dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
  };

  const selectClone = () => {
    if (!clone) return;
    dispatch(
      setSelectedItem({
        id: clone.id,
        nodeId: clone.id,
        type: "NODE",
        nodeType: "ANNOTATION",
        annotationType: "BASE_MAP_LINK",
        listingId: clone.listingId,
        annotationTemplateId: clone.annotationTemplateId,
        pointId: null,
        partId: null,
        partType: null,
      })
    );
  };

  const handleRowClick = () => {
    if (hasClone) selectClone();
    else armClone();
  };

  const handleToggleHidden = async (e) => {
    e.stopPropagation();
    if (!clone) return;
    await db.annotations.update(clone.id, { hidden: !clone.hidden });
    dispatch(triggerAnnotationsUpdate());
  };

  const handleReposition = async (e) => {
    e.stopPropagation();
    if (!clone) return;
    await deleteAnnotations([clone.id]);
    armClone();
  };

  // render

  return (
    <ListItemButton
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: "relative",
        bgcolor: "white",
        alignItems: "center",
        justifyContent: "space-between",
        pl: 1,
        pr: 1,
        py: 0.5,
        borderLeft: "3px solid",
        borderColor: isHovered ? color : "transparent",
        cursor: "pointer",
        "&:hover": { bgcolor: alpha(color, 0.1) },
      }}
    >
      <Tooltip title={hasClone ? selectS : drawS} arrow placement="left">
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
              opacity: isHidden ? 0.4 : 1,
              filter: isHidden ? "grayscale(100%)" : "none",
            }}
          >
            <AnnotationTemplateIcon
              template={template ?? { ...link, drawingShape: "BASE_MAP_LINK" }}
              size={18}
              spriteImage={spriteImage}
            />
          </Box>
          <Typography
            variant="body2"
            color={isHidden ? "text.disabled" : "panel.textPrimary"}
            sx={{
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              userSelect: "none",
            }}
          >
            {label}
          </Typography>
        </Box>
      </Tooltip>

      {/* Right side: reposition + eye on hover (clone drawn) OR count */}
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
        {isHovered && hasClone ? (
          <>
            <Tooltip title={repositionS} arrow placement="top">
              <IconButton
                size="small"
                onClick={handleReposition}
                sx={{ p: 0.5, color: "panel.iconMuted" }}
              >
                <Replay fontSize="inherit" sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={isHidden ? showS : hideS} arrow placement="right">
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
                : hasClone
                  ? "secondary.main"
                  : "panel.countEmpty"
            }
          >
            {hasClone ? "1 u" : "0 u"}
          </Typography>
        )}
      </Box>
    </ListItemButton>
  );
}
