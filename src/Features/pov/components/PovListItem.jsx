import { useState } from "react";

import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { CloudUpload as ShareIcon } from "@mui/icons-material";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import usePovImageUrl from "../hooks/usePovImageUrl";
import usePushPovPreview from "../hooks/usePushPovPreview";
import getPovCaption, { getPovModeLabel } from "../utils/getPovCaption";

// One row of the POV list: draggable (dnd-kit sortable), thumbnail +
// description + creation caption (trigram — date) + share button.
export default function PovListItem({ pov, isSelected, onClick }) {
  const dispatch = useDispatch();

  // data

  const imageUrl = usePovImageUrl(pov.image?.fileName);
  const pushPovPreview = usePushPovPreview();

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: pov.id });

  // state

  const [sharing, setSharing] = useState(false);

  // helpers

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const description = pov.description?.trim();
  const caption = getPovCaption(pov);
  const modeLabel = getPovModeLabel(pov);

  const isShared = Boolean(pov.idMaster);
  const shareTooltip = isShared ? "Mettre à jour le partage" : "Partager";

  // handlers

  async function handleShareClick(event) {
    event.stopPropagation();
    if (sharing) return;
    setSharing(true);
    try {
      await pushPovPreview(pov);
    } catch (error) {
      console.error("[PovListItem] share error", error);
      dispatch(
        setToaster({ message: "Échec du partage du point de vue", isError: true })
      );
    } finally {
      setSharing(false);
    }
  }

  // render

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      sx={{
        ...style,
        display: "flex",
        gap: 1,
        p: 1,
        cursor: "pointer",
        borderRadius: 1,
        border: (theme) =>
          `1px solid ${isSelected ? theme.palette.primary.main : theme.palette.divider}`,
        bgcolor: isSelected ? "action.selected" : "background.paper",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box
        sx={{
          width: 84,
          minWidth: 84,
          height: 60,
          borderRadius: 0.5,
          overflow: "hidden",
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imageUrl && (
          <Box
            component="img"
            src={imageUrl}
            alt=""
            sx={{ width: 1, height: 1, objectFit: "contain" }}
          />
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: isSelected ? "bold" : "normal",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            ...(description
              ? {}
              : { color: "text.secondary", fontStyle: "italic" }),
          }}
        >
          {description || "Sans description"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {modeLabel}
          {caption ? ` · ${caption}` : ""}
        </Typography>
      </Box>

      {sharing ? (
        <Box
          sx={{
            alignSelf: "center",
            flexShrink: 0,
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress size={16} />
        </Box>
      ) : (
        <Tooltip title={shareTooltip}>
          <IconButton
            size="small"
            onClick={handleShareClick}
            // keep the click away from the row's dnd-kit drag listeners
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              alignSelf: "center",
              flexShrink: 0,
              color: isShared ? "primary.main" : "text.secondary",
            }}
          >
            <ShareIcon sx={{ fontSize: "1rem" }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
