import { DndContext } from "@dnd-kit/core";

import useScopeFavorites from "Features/scopeFavorites/hooks/useScopeFavorites";
import useOpenDashboardScope from "../hooks/useOpenDashboardScope";

import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { Refresh } from "@mui/icons-material";

import ListItemDashboardScope from "./ListItemDashboardScope";

// Second section of the dashboard project panel: the Krtos of the project
// linked to `item` (edx: the opportunité of a chantier — rule and labels from
// appConfig features.masterProjects.linkedProjectScopes).
// Read-only list (no reorder, no delete). Opening a Krto from here records
// `item` as its opening source, so its duplication targets `item`'s project.
// `linkedScopes` = useLinkedProjectScopes(item), owned by the panel so its
// own refresh button reloads this list too.
// Renders nothing when the item has no linked project.

export default function SectionDashboardLinkedProjectScopes({
  item,
  linkedScopes,
}) {
  // data

  const { rule, rows, loading, refresh, linkedProjectId, linkedProject } =
    linkedScopes;
  const { toggleFavorite } = useScopeFavorites();
  const openScope = useOpenDashboardScope();

  // strings

  const titleS = rule?.title ?? "";
  const emptyS = rule?.emptyLabel ?? "";
  const refreshS = "Actualiser";

  // helpers

  const count = rows.length;

  // handlers

  function handleToggleFavorite(row) {
    toggleFavorite({
      scopeId: row.scopeId,
      scopeName: row.name,
      projectName: linkedProject.name,
      projectClientRef: linkedProject.clientRef,
      projectType: rule?.linkedProjectType,
    });
  }

  function handleOpen(row) {
    openScope({
      row,
      projectId: linkedProjectId,
      openingSourceProjectId: item?.projectId,
    });
  }

  // render

  if (!rule) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>{titleS}</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {count} élément{count > 1 ? "s" : ""}
        </Typography>
        {loading ? (
          <CircularProgress size={12} color="inherit" sx={{ ml: 0.5 }} />
        ) : (
          <Tooltip title={refreshS}>
            <IconButton size="small" onClick={refresh}>
              <Refresh sx={{ fontSize: "1.1rem" }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {count === 0 ? (
        !loading && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {emptyS}
          </Typography>
        )
      ) : (
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "white",
          }}
        >
          {/* ListItemDashboardScope is a dnd-kit sortable: it needs a
              DndContext even when read-only */}
          <DndContext id="dashboard-linked-scopes-dnd">
            {rows.map((row) => (
              <ListItemDashboardScope
                key={row.scopeId}
                row={row}
                readOnly
                onToggleFavorite={handleToggleFavorite}
                onOpen={handleOpen}
              />
            ))}
          </DndContext>
        </Box>
      )}
    </Box>
  );
}
