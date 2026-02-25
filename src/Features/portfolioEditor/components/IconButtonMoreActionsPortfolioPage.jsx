import { useState } from "react";

import { useDispatch } from "react-redux";

import useDuplicatePortfolioPage from "Features/portfolioPages/hooks/useDuplicatePortfolioPage";
import useDeletePortfolioPage from "Features/portfolioPages/hooks/useDeletePortfolioPage";

import { setSelectedItem } from "Features/selection/selectionSlice";

import { IconButton, Menu, MenuItem, Divider } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

export default function IconButtonMoreActionsPortfolioPage({ page }) {
  const dispatch = useDispatch();

  // data

  const duplicatePortfolioPage = useDuplicatePortfolioPage();
  const deletePortfolioPage = useDeletePortfolioPage();

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

  const handleDuplicate = async () => {
    const newPage = await duplicatePortfolioPage(page);
    dispatch(
      setSelectedItem({
        id: newPage.id,
        type: "PORTFOLIO_PAGE",
        portfolioId: newPage.portfolioId,
      })
    );
    setAnchorEl(null);
  };

  const handleDelete = () => {
    setAnchorEl(null);
    setOpenDelete(true);
  };

  // render

  return (
    <>
      <IconButton onClick={handleClick}>
        <MoreActionsIcon />
      </IconButton>

      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        <MenuItem onClick={handleDuplicate}>Dupliquer</MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={async () => {
          await deletePortfolioPage(page.id);
          dispatch(setSelectedItem({}));
          setOpenDelete(false);
        }}
      />
    </>
  );
}
