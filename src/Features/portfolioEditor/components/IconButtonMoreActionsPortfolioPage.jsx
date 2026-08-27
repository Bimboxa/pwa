import { useState } from "react";

import { useDispatch } from "react-redux";

import useDuplicatePortfolioPage from "Features/portfolioPages/hooks/useDuplicatePortfolioPage";
import useDeletePortfolioPage from "Features/portfolioPages/hooks/useDeletePortfolioPage";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";

import { IconButton, Menu, MenuItem, Divider } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

export default function IconButtonMoreActionsPortfolioPage({
  page,
  portfolio: portfolioProp,
  onRename,
  ...iconButtonProps
}) {
  const dispatch = useDispatch();

  // data

  const duplicatePortfolioPage = useDuplicatePortfolioPage();
  const deletePortfolioPage = useDeletePortfolioPage();
  const { value: displayedPortfolio } = useDisplayedPortfolio();

  const portfolio = portfolioProp ?? displayedPortfolio;

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

  const handleDuplicate = async () => {
    if (!portfolio) return;
    const newPage = await duplicatePortfolioPage(page, portfolio);
    dispatch(setDisplayedPortfolioId(portfolio.id));
    dispatch(
      setSelectedItem({
        id: newPage.id,
        type: "PORTFOLIO_PAGE",
        portfolioId: newPage.listingId,
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
      <IconButton onClick={handleClick} {...iconButtonProps}>
        <MoreActionsIcon fontSize="inherit" />
      </IconButton>

      <Menu open={open} anchorEl={anchorEl} onClose={handleClose}>
        {onRename && <MenuItem onClick={handleRename}>Renommer</MenuItem>}
        <MenuItem onClick={handleDuplicate}>Dupliquer</MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          Supprimer
        </MenuItem>
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
