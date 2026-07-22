import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { CenterFocusStrong as ApplyIcon } from "@mui/icons-material";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import IconButtonMoreActionsPov from "./IconButtonMoreActionsPov";
import usePovImageUrl from "../hooks/usePovImageUrl";
import getPovCaption, { getPovModeLabel } from "../utils/getPovCaption";

// One row of the POV list: draggable (dnd-kit sortable), thumbnail +
// description + creation caption (trigram — date). Clicking the row only
// SELECTS the view (arms the capture frame); the actions at the bottom right
// apply the saved view (camera + filters) or open the "..." menu.
export default function PovListItem({ pov, isSelected, onClick, onApply }) {
  // strings

  const applyS = "Appliquer la vue";

  // data

  const imageUrl = usePovImageUrl(pov.image?.fileName);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: pov.id });

  // helpers

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const description = pov.description?.trim();
  const caption = getPovCaption(pov);
  const modeLabel = getPovModeLabel(pov);

  // handlers

  function handleApplyClick(event) {
    event.stopPropagation();
    onApply?.();
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

        {/* actions, bottom right of the card */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <Tooltip title={applyS}>
            <IconButton
              size="small"
              onClick={handleApplyClick}
              // keep the click away from the row's dnd-kit drag listeners
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ApplyIcon sx={{ fontSize: "1rem" }} />
            </IconButton>
          </Tooltip>

          <IconButtonMoreActionsPov pov={pov} size="small" />
        </Box>
      </Box>
    </Box>
  );
}
