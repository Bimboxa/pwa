import { useEffect, useState } from "react";

import { Box, IconButton, InputBase, Typography } from "@mui/material";
import { MoreVert } from "@mui/icons-material";

import usePlanningActions from "../hooks/usePlanningActions";
import MenuActionsPlanningResource from "./MenuActionsPlanningResource";

import { LEFT_COL_WIDTH, ROW_HEIGHT } from "../constants/planningDefaults";

// Left (sticky) cell of a resource row: label (double-click = inline
// rename), actions menu.
export default function PlanningResourceRow({
  resource,
  slotsCount,
  canMoveUp,
  canMoveDown,
}) {
  const { updateResource } = usePlanningActions();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(resource.label ?? "");
  const [menuAnchor, setMenuAnchor] = useState(null);

  useEffect(() => {
    if (!editing) setDraft(resource.label ?? "");
  }, [resource.label, editing]);

  async function commit() {
    setEditing(false);
    const label = draft.trim();
    if (label && label !== resource.label)
      await updateResource(resource.id, { label });
  }

  return (
    <Box
      sx={{
        position: "sticky",
        left: 0,
        // Above a selected block (zIndex 2): both live in the same stacking
        // context and the band comes after this cell in DOM order.
        zIndex: 3,
        width: LEFT_COL_WIDTH,
        minWidth: LEFT_COL_WIDTH,
        height: ROW_HEIGHT,
        display: "flex",
        alignItems: "center",
        px: 1,
        bgcolor: "background.paper",
        borderRight: "1px solid",
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:hover .planning-resource-menu": { visibility: "visible" },
      }}
      onDoubleClick={() => setEditing(true)}
    >
      {editing ? (
        <InputBase
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(resource.label ?? "");
              setEditing(false);
            }
          }}
          sx={{ fontSize: "0.85rem", flex: 1, minWidth: 0 }}
        />
      ) : (
        <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {resource.label}
        </Typography>
      )}
      <IconButton
        className="planning-resource-menu"
        size="small"
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        sx={{ visibility: menuAnchor ? "visible" : "hidden", p: 0.25 }}
      >
        <MoreVert sx={{ fontSize: 16 }} />
      </IconButton>
      {menuAnchor && (
        <MenuActionsPlanningResource
          anchorEl={menuAnchor}
          resource={resource}
          slotsCount={slotsCount}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onRename={() => setEditing(true)}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </Box>
  );
}
