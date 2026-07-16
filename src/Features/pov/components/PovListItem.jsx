import { Box, Typography } from "@mui/material";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import usePovImageUrl from "../hooks/usePovImageUrl";

// One row of the POV list: draggable (dnd-kit sortable), thumbnail +
// description + creation caption (trigram — date).
export default function PovListItem({ pov, isSelected, onClick }) {
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

  const createdDate = pov.createdAt
    ? new Date(pov.createdAt).toLocaleDateString("fr-FR")
    : null;
  const caption = [pov.createdBy?.trigram, createdDate]
    .filter(Boolean)
    .join(" — ");

  const modeLabel = pov.viewerMode === "THREED" ? "3D" : "2D";

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
    </Box>
  );
}
