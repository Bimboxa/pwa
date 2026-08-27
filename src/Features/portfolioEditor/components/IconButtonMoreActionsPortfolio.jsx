import { useState } from "react";

import { useDispatch } from "react-redux";

import useDeletePortfolio from "../hooks/useDeletePortfolio";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";

import { IconButton, Menu, MenuItem } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

export default function IconButtonMoreActionsPortfolio({
  portfolio,
  onRename,
  ...iconButtonProps
}) {
  const dispatch = useDispatch();

  // data

  const deletePortfolio = useDeletePortfolio();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [openDelete, setOpenDelete] = useState(false);

  // handlers

  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleRename = () => {
    setAnchorEl(null);
    onRename?.();
  };

  const handleDelete = () => {
    setAnchorEl(null);
    setOpenDelete(true);
  };

  // render

  return (
    <>
      <IconButton onClick={handleClick} {...iconButtonProps}>
        <MoreActionsIcon fontSize="inherit" />
      </IconButton>

      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        {onRename && <MenuItem onClick={handleRename}>Renommer</MenuItem>}
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          Supprimer
        </MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={async () => {
          await deletePortfolio(portfolio.id);
          dispatch(setSelectedItem({}));
          dispatch(setDisplayedPortfolioId(null));
          setOpenDelete(false);
        }}
      />
    </>
  );
}
