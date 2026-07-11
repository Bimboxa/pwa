import { useState } from "react";

import { IconButton, Menu, MenuItem } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import useDeleteBaseMapVersion from "Features/baseMaps/hooks/useDeleteBaseMapVersion";

export default function IconButtonMoreActionsBaseMapVersion({
  baseMap,
  version,
  ...iconButtonProps
}) {
  // strings

  const deleteS = "Supprimer";

  // data

  const deleteVersion = useDeleteBaseMapVersion();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);

  // helpers

  const canDelete = (baseMap?.versions?.length ?? 0) > 1;

  // handlers

  function handleClick(event) {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleDelete() {
    setAnchorEl(null);
    setOpenDelete(true);
  }

  async function handleConfirmDelete() {
    setOpenDelete(false);
    await deleteVersion({ baseMapId: baseMap.id, versionId: version.id });
  }

  // render

  return (
    <>
      <IconButton size="small" onClick={handleClick} {...iconButtonProps}>
        <MoreActionsIcon fontSize="inherit" />
      </IconButton>

      <Menu open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={handleClose}>
        <MenuItem onClick={handleDelete} disabled={!canDelete}>
          {deleteS}
        </MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={handleConfirmDelete}
      />
    </>
  );
}
