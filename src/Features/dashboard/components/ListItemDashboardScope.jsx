import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import {
  Star,
  StarBorder,
  DeleteOutline,
  CloudQueue,
  DragIndicator,
} from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import AvatarPovPreview from "./AvatarPovPreview";
import ChipsScopeStats from "./ChipsScopeStats";

// Renders one krto row — either a local scope or a remote (not installed)
// scope configuration. Clicking the row opens the krto.
// Local rows are sortable (dnd-kit, parent DndContext / SortableContext):
// the drag handle, shown on hover, is the only drag source so the click /
// star / trash keep working. A remote row has no scope record to rank.
// `row` = { scopeId, name, subText, isLocal, isFavorite, povPreviews,
//           annotationsCount, baseMapsCount }
// `subText` = "author trigram, last configuration date".

export default function ListItemDashboardScope({
  row,
  onToggleFavorite,
  onOpen,
  onDelete,
}) {
  // data

  const appConfig = useAppConfig();

  // strings

  const notInstalledS =
    appConfig?.strings?.scope?.notInstalledTooltip ??
    "Plan de repérage non installé sur cet appareil";
  const dragS = "Glisser pour réordonner";

  // data - sortable

  const sortable = Boolean(row.isLocal);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.scopeId, disabled: !sortable });

  // handlers

  function handleFavoriteClick(e) {
    e.stopPropagation();
    onToggleFavorite(row);
  }

  function handleDeleteClick(e) {
    e.stopPropagation();
    onDelete(row);
  }

  // render

  return (
    <Box
      ref={setNodeRef}
      onClick={() => onOpen(row)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1200 : "auto",
        opacity: isDragging ? 0.8 : 1,
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        pl: 1,
        pr: 2,
        py: 1.25,
        cursor: "pointer",
        bgcolor: "white",
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
        "&:last-child": { borderBottom: "none" },
        // Opacity only (never visibility: hidden) so the handle keeps its
        // pointer events — a touch device has no hover.
        "&:hover .dashboardScopeDragHandle": { opacity: sortable ? 1 : 0 },
      }}
    >
      <Tooltip title={sortable ? dragS : ""} arrow placement="left">
        <Box
          component="span"
          className="dashboardScopeDragHandle"
          {...(sortable ? attributes : {})}
          {...(sortable ? listeners : {})}
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
            color: "text.secondary",
            cursor: sortable ? "grab" : "default",
            touchAction: "none",
            opacity: isDragging ? 1 : 0,
            transition: "opacity 0.15s ease",
            "&:active": { cursor: sortable ? "grabbing" : "default" },
          }}
        >
          <DragIndicator sx={{ fontSize: 18 }} />
        </Box>
      </Tooltip>

      <Tooltip
        title={row.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <IconButton size="small" onClick={handleFavoriteClick} sx={{ p: 0.5 }}>
          {row.isFavorite ? (
            <Star sx={{ color: "#f5a623", fontSize: "1.2rem" }} />
          ) : (
            <StarBorder sx={{ color: "#b9b9c8", fontSize: "1.2rem" }} />
          )}
        </IconButton>
      </Tooltip>

      <AvatarPovPreview povPreviews={row.povPreviews} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
            {row.name}
          </Typography>
          {!row.isLocal && (
            <Tooltip title={notInstalledS}>
              <CloudQueue
                sx={{
                  color: "text.secondary",
                  fontSize: "1.05rem",
                  flexShrink: 0,
                }}
              />
            </Tooltip>
          )}
        </Box>
        {row.subText && (
          <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
            {row.subText}
          </Typography>
        )}
      </Box>

      <ChipsScopeStats
        baseMapsCount={row.baseMapsCount}
        annotationsCount={row.annotationsCount}
      />

      {row.isLocal && (
        <Tooltip title="Supprimer">
          <IconButton
            size="small"
            onClick={handleDeleteClick}
            sx={{ color: "text.secondary" }}
          >
            <DeleteOutline />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
