import { useMemo, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  selectSelectedItems,
  setSelectedItems,
} from "Features/selection/selectionSlice";

import {
  Box,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import usePanelResize from "Features/layout/hooks/usePanelResize";
import PanelFooter from "Features/layout/components/PanelFooter";

import IconCutLineTrace from "./IconCutLineTrace";
import { CUT_LINE_LABEL } from "../constants/cutLineStyle";

// « Lignes de coupe » section of a multi-selection (stacked under
// ToolbarEditAnnotations, like the « Mailles » one): cut lines are not
// regular annotations — no template, no quantities — so they get their own
// list (one chip per line, removable from the selection) and delete.
// `cutLines`: every CUT_LINE annotation of the scene; the selected ones are
// resolved here. Renders nothing when none is selected.
export default function ToolbarEditCutLines({ cutLines, onDragStart }) {
  const dispatch = useDispatch();

  // strings

  const clearS = "Vider la sélection de lignes de coupe";
  const deleteS = "Supprimer les lignes de coupe";

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const deleteAnnotations = useDeleteAnnotations();

  // state

  // Resize (bottom band, same mechanics as the other sections). The toolbar
  // is centred in its popper: widthFactor 2 keeps the handle under the cursor.
  const paperRef = useRef(null);
  const {
    size,
    isAutoHeight,
    handleResizeMouseDown,
    fitContent,
    reset: resetSize,
  } = usePanelResize({ paperRef, widthFactor: 2 });

  // helpers

  const selectedCutLines = useMemo(() => {
    const ids = new Set(selectedItems.map((item) => item.nodeId));
    return (cutLines || []).filter((a) => ids.has(a.id));
  }, [cutLines, selectedItems]);

  const count = selectedCutLines.length;
  if (count === 0) return null;

  const countLabel = `${count} ligne${count > 1 ? "s" : ""} de coupe`;

  // The other selected items (annotations, mailles) survive the actions.
  function getOtherItems(removedIds) {
    return selectedItems.filter((item) => !removedIds.has(item.nodeId));
  }

  // handlers

  function handleRemoveFromSelection(cutLineId) {
    dispatch(setSelectedItems(getOtherItems(new Set([cutLineId]))));
  }

  function handleClearSelection() {
    dispatch(
      setSelectedItems(
        getOtherItems(new Set(selectedCutLines.map((a) => a.id)))
      )
    );
  }

  async function handleDeleteClick() {
    const ids = selectedCutLines.map((a) => a.id);
    const otherItems = getOtherItems(new Set(ids));
    await deleteAnnotations(ids);
    dispatch(setSelectedItems(otherItems));
  }

  // render

  return (
    <Paper
      ref={paperRef}
      elevation={6}
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        // Follows the popper width (the chips wrap, they never widen it)
        // until it is resized on its own.
        ...(size
          ? { alignSelf: "center", width: size.width, height: size.height }
          : { alignSelf: "stretch", width: 0, minWidth: "max(100%, 280px)" }),
      }}
    >
      {/* Top band — count */}
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{ px: 1, py: 0.75 }}
      >
        <Box
          onMouseDown={onDragStart}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "grab",
            color: "text.disabled",
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
        <IconCutLineTrace fontSize="small" color="action" />
        {/* Same header type as ToolbarEditAnnotations */}
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, fontSize: "0.8rem" }}
        >
          {countLabel}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title={clearS}>
          <IconButton size="small" onClick={handleClearSelection}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Divider />

      {/* Middle band — one chip per line (scrolls on a large selection) */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          px: 1,
          py: 1,
          alignContent: "flex-start",
          // Takes the slack once resized.
          flex: "1 1 auto",
          minHeight: 0,
          ...(!size && { maxHeight: 132 }),
          overflowY: "auto",
        }}
      >
        {selectedCutLines.map((cutLine) => (
          <Chip
            key={cutLine.id}
            size="small"
            variant="outlined"
            label={cutLine.label || CUT_LINE_LABEL}
            onDelete={() => handleRemoveFromSelection(cutLine.id)}
          />
        ))}
      </Box>

      <Divider />

      {/* Bottom band — delete */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        sx={{ px: 1, py: 0.5 }}
      >
        <Tooltip title={deleteS}>
          <IconButton size="small" color="error" onClick={handleDeleteClick}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Bottom band: "auto" height + resize handle */}
      <PanelFooter
        onResizeMouseDown={handleResizeMouseDown}
        onResetSize={resetSize}
        onFitContent={fitContent}
        isAutoHeight={isAutoHeight}
      />
    </Paper>
  );
}
