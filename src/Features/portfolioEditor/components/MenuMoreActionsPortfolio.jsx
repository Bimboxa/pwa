import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";

import { Menu, MenuItem } from "@mui/material";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import useDeletePortfolio from "../hooks/useDeletePortfolio";

import { OwnershipError } from "App/db/ownership";

// ---------------------------------------------------------------------------
// MenuMoreActionsPortfolio — "…" menu of a portfolio (Renommer / Supprimer),
// controlled by its anchor so any host can open it: the tree's icon button
// (IconButtonMoreActionsPortfolio) or the floating manager's header.
// ---------------------------------------------------------------------------

export default function MenuMoreActionsPortfolio({
  anchorEl,
  onClose,
  portfolio,
  onRename,
}) {
  const dispatch = useDispatch();

  // strings

  const renameS = "Renommer";
  const deleteS = "Supprimer";

  // data

  const deletePortfolio = useDeletePortfolio();

  // state

  const [openDelete, setOpenDelete] = useState(false);

  // handlers

  const handleRename = () => {
    onClose();
    onRename?.();
  };

  const handleDelete = () => {
    onClose();
    setOpenDelete(true);
  };

  // render

  return (
    <>
      <Menu open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={onClose}>
        {onRename && <MenuItem onClick={handleRename}>{renameS}</MenuItem>}
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          {deleteS}
        </MenuItem>
      </Menu>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={async () => {
          try {
            await deletePortfolio(portfolio.id);
            dispatch(setSelectedItem({}));
            dispatch(setDisplayedPortfolioId(null));
          } catch (error) {
            if (!(error instanceof OwnershipError)) throw error;
          }
          setOpenDelete(false);
        }}
      />
    </>
  );
}
