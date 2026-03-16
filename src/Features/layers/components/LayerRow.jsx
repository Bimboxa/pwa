import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  setActiveLayerId,
  toggleLayerVisibility,
  toggleShowAnnotationsWithoutLayer,
} from "../layersSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import {
  Box,
  ListItemButton,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Tune from "@mui/icons-material/Tune";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

// ---------------------------------------------------------------------------
// LayerRow — a single layer in the layers list (sortable)
// ---------------------------------------------------------------------------

export default function LayerRow({
  layer,
  count,
  isNoLayerRow,
}) {
  const dispatch = useDispatch();

  // data

  const activeLayerId = useSelector((s) => s.layers.activeLayerId);
  const hiddenLayerIds = useSelector((s) => s.layers.hiddenLayerIds);
  const showAnnotationsWithoutLayer = useSelector(
    (s) => s.layers.showAnnotationsWithoutLayer
  );

  // state

  const [isHovered, setIsHovered] = useState(false);

  // sortable (disabled for "Sans calque" row)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer?.id ?? "__no_layer__", disabled: isNoLayerRow });

  const sortableStyle = !isNoLayerRow
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1200 : "auto",
        opacity: isDragging ? 0.5 : 1,
      }
    : {};

  // helpers

  const isActive = isNoLayerRow
    ? activeLayerId === null
    : activeLayerId === layer?.id;
  const isHidden = isNoLayerRow
    ? !showAnnotationsWithoutLayer
    : hiddenLayerIds.includes(layer?.id);

  // handlers

  const handleClick = () => {
    if (isNoLayerRow) {
      dispatch(setActiveLayerId(null));
    } else {
      const newActiveId = isActive ? null : layer.id;
      dispatch(setActiveLayerId(newActiveId));
      if (newActiveId) {
        dispatch(setSelectedItem({ id: layer.id, type: "LAYER" }));
      }
    }
  };

  const handleToggleVisibility = (e) => {
    e.stopPropagation();
    if (isNoLayerRow) {
      dispatch(toggleShowAnnotationsWithoutLayer());
    } else {
      dispatch(toggleLayerVisibility(layer.id));
    }
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    dispatch(setSelectedItem({ id: layer.id, type: "LAYER" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };

  // render

  return (
    <ListItemButton
      ref={setNodeRef}
      {...(!isNoLayerRow ? attributes : {})}
      component="div"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        ...sortableStyle,
        bgcolor: "white",
        alignItems: "center",
        justifyContent: "space-between",
        pl: isNoLayerRow ? 2 : 0.5,
        pr: 1,
        py: 0.5,
        borderLeft: "3px solid",
        borderColor: isActive ? "secondary.main" : "transparent",
        opacity: isHidden ? 0.5 : 1,
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      {/* Left: drag handle (layers only, visible on hover) */}
      {!isNoLayerRow && (
        <Box
          {...listeners}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "grab",
            "&:active": { cursor: "grabbing" },
            visibility: isHovered || isDragging ? "visible" : "hidden",
            mr: 0.5,
          }}
        >
          <DragIndicatorIcon
            sx={{ fontSize: 16, color: "panel.textLight" }}
          />
        </Box>
      )}

        {/* Layer name */}
        <Typography
          variant="body2"
          sx={{
            fontSize: "0.8125rem",
            fontWeight: isActive ? 600 : 400,
            color: isActive ? "secondary.main" : "panel.textSecondary",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            userSelect: "none",
            fontStyle: isNoLayerRow ? "italic" : "normal",
            flex: 1,
            minWidth: 0,
          }}
        >
          {isNoLayerRow ? "Sans calque" : layer.name}
        </Typography>

        {/* Right side: count + buttons stacked with visibility toggle */}
        <Box
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            ml: 1,
            minWidth: isNoLayerRow ? 24 : 48,
            height: 24,
            flexShrink: 0,
          }}
        >
          {/* Count — always in DOM, hidden on hover */}
          <Typography
            align="right"
            noWrap
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              fontSize: "10px",
              fontFamily: "monospace",
              fontWeight: 500,
              color: isActive && count > 0 ? "secondary.main" : "panel.countEmpty",
              visibility: isHovered ? "hidden" : "visible",
            }}
          >
            {count}
          </Typography>

          {/* Buttons — always in DOM, visible on hover */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 0.75,
              visibility: isHovered ? "visible" : "hidden",
            }}
          >
            {!isNoLayerRow && (
              <Tooltip title="Propriétés" arrow>
                <IconButton
                  size="small"
                  onClick={handleEdit}
                  sx={{ p: 0, color: "panel.iconMuted" }}
                >
                  <Tune sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={isHidden ? "Afficher" : "Masquer"} arrow>
              <IconButton
                size="small"
                onClick={handleToggleVisibility}
                sx={{ p: 0, color: isHidden ? "secondary.main" : "panel.iconMuted" }}
              >
                {isHidden ? (
                  <VisibilityOff sx={{ fontSize: 16 }} />
                ) : (
                  <Visibility sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </ListItemButton>
  );
}
