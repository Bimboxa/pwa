import { useEffect, useState } from "react";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import {
  AddLocationAltOutlined,
  DeleteOutline,
  EditOutlined,
  OpenInNew,
  WidgetsOutlined,
} from "@mui/icons-material";

// One block row of the library (« Blocs » chip). Clicking the row opens the
// blocks base map where the block is drawn; « Positionner » arms the
// placement of instances on the plan. Delete asks for a second click.
export default function ListItemBlockInLibrary({
  block,
  onOpen,
  onPlace,
  onRename,
  onDelete,
}) {
  // strings

  const openS = "Ouvrir le fond de plan du bloc";
  const placeS = "Positionner sur le plan";
  const placeEmptyS = "Bloc vide : liez-lui d'abord des annotations";
  const renameS = "Renommer";
  const deleteS = "Supprimer le bloc";
  const confirmDeleteS = "Cliquez à nouveau pour supprimer";

  // state

  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return undefined;
    const timeout = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(timeout);
  }, [confirmDelete]);

  // helpers

  const membersS = `${block.membersCount} annotation${
    block.membersCount > 1 ? "s" : ""
  }`;
  const instancesS = `${block.instancesCount} instance${
    block.instancesCount > 1 ? "s" : ""
  }`;

  // handlers

  function handleRename(e) {
    e.stopPropagation();
    onRename(block);
  }

  function handleDelete(e) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
    onDelete(block);
  }

  // render

  return (
    <Box
      onClick={() => onOpen(block)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
        "&:hover": { boxShadow: 2, borderColor: "primary.main" },
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 1.5,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <WidgetsOutlined sx={{ color: "text.disabled" }} />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
          {block.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {membersS} · {instancesS}
        </Typography>
      </Box>
      <Tooltip title={renameS}>
        <IconButton size="small" onClick={handleRename}>
          <EditOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={confirmDelete ? confirmDeleteS : deleteS}>
        <IconButton
          size="small"
          color={confirmDelete ? "error" : "default"}
          onClick={handleDelete}
        >
          <DeleteOutline fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={block.membersCount > 0 ? placeS : placeEmptyS}>
        <span>
          <IconButton
            size="small"
            color="primary"
            disabled={block.membersCount === 0}
            onClick={(e) => {
              e.stopPropagation();
              onPlace(block);
            }}
          >
            <AddLocationAltOutlined fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={openS}>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(block);
          }}
        >
          <OpenInNew fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
