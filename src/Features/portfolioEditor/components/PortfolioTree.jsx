import { useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box, List, ListItemButton, Typography } from "@mui/material";

import usePortfolios from "Features/portfolios/hooks/usePortfolios";
import useCreatePortfolio from "Features/portfolios/hooks/useCreatePortfolio";

import PortfolioTreeItem from "./PortfolioTreeItem";
import DialogCreatePortfolio from "./DialogCreatePortfolio";

export default function PortfolioTree() {
  const dispatch = useDispatch();

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );
  const { value: portfolios } = usePortfolios({ filterByScopeId: scopeId });
  const createPortfolio = useCreatePortfolio();

  // state

  const [openDialog, setOpenDialog] = useState(false);

  // effects

  useEffect(() => {
    if (displayedPortfolioId) return;
    if (!portfolios?.length) return;
    const first = portfolios[0];
    dispatch(setDisplayedPortfolioId(first.id));
    dispatch(setSelectedItem({ id: first.id, type: "PORTFOLIO" }));
  }, [displayedPortfolioId, portfolios, dispatch]);

  // handlers

  async function handleCreate(title) {
    const portfolio = await createPortfolio({
      scopeId,
      projectId,
      title,
    });
    dispatch(setDisplayedPortfolioId(portfolio.id));
  }

  // render

  return (
    <Box sx={{ p: 1 }}>
      <List dense disablePadding>
        {portfolios?.map((portfolio) => (
          <PortfolioTreeItem key={portfolio.id} portfolio={portfolio} />
        ))}
      </List>

      <ListItemButton onClick={() => setOpenDialog(true)} sx={{ py: 1 }}>
        <Typography variant="body2" color="text.secondary">
          + Nouveau portfolio
        </Typography>
      </ListItemButton>

      <DialogCreatePortfolio
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreate={handleCreate}
      />
    </Box>
  );
}
