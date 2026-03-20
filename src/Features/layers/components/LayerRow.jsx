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
  Switch,
  Tooltip,
} from "@mui/material";
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
  const isEnabled = isNoLayerRow
    ? showAnnotationsWithoutLayer
    : !hiddenLayerIds.includes(layer?.id);

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

  const handleToggleEnabled = (e) => {
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
        bgcolor: isActive ? (theme) => theme.palette.secondary.main + "14" : "white",
        alignItems: "center",
        pl: 0.5,
        pr: 1,
        py: 0.5,
        borderLeft: "3px solid",
        borderColor: isActive ? "secondary.main" : "transparent",
        "&:hover": { bgcolor: isActive ? (theme) => theme.palette.secondary.main + "20" : "action.hover" },
      }}
    >
      {/* Drag handle — layers: visible on hover; "Sans calque": invisible spacer */}
      <Box
        {...(!isNoLayerRow ? listeners : {})}
        sx={{
          display: "flex",
          alignItems: "center",
          width: 20,
          flexShrink: 0,
          ...(!isNoLayerRow && {
            cursor: "grab",
            "&:active": { cursor: "grabbing" },
            visibility: isHovered || isDragging ? "visible" : "hidden",
          }),
        }}
      >
        {!isNoLayerRow && (
          <DragIndicatorIcon
            sx={{ fontSize: 16, color: "panel.textLight" }}
          />
        )}
      </Box>

      {/* Switch to enable/disable layer */}
      <Switch
        size="small"
        checked={isEnabled}
        onClick={handleToggleEnabled}
        sx={{
          mr: 0.5,
          "& .MuiSwitch-switchBase": { p: 0.4 },
          "& .MuiSwitch-thumb": { width: 10, height: 10 },
          "& .MuiSwitch-track": { borderRadius: 10 },
          width: 30,
          height: 20,
        }}
      />

      {/* Layer name */}
      <Typography
        variant="body2"
        sx={{
          fontSize: "0.8125rem",
          fontWeight: isActive ? 600 : 400,
          color: !isEnabled
            ? "text.disabled"
            : isActive
              ? "secondary.main"
              : "panel.textSecondary",
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

      {/* Right side: edit button (hover only) + count */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          ml: 1,
          gap: 0.5,
          minWidth: 40,
          flexShrink: 0,
        }}
      >
        {/* Edit button — visible on hover only, layers only */}
        {!isNoLayerRow && (
          <Tooltip title="Propriétés" arrow>
            <IconButton
              size="small"
              onClick={handleEdit}
              sx={{
                p: 0,
                color: "panel.iconMuted",
                visibility: isHovered ? "visible" : "hidden",
              }}
            >
              <Tune sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Annotation count — always visible */}
        <Typography
          align="right"
          noWrap
          sx={{
            fontSize: "10px",
            fontFamily: "monospace",
            fontWeight: 500,
            minWidth: 20,
            color: !isEnabled
              ? "panel.countEmpty"
              : isActive && count > 0
                ? "secondary.main"
                : count > 0
                  ? "text.primary"
                  : "panel.countEmpty",
          }}
        >
          {count}
        </Typography>
      </Box>
    </ListItemButton>
  );
}
