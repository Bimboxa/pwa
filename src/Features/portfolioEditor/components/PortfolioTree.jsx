import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box, Button, List } from "@mui/material";

import usePortfolios from "Features/portfolios/hooks/usePortfolios";

import PortfolioTreeItem from "./PortfolioTreeItem";

export default function PortfolioTree({ onCreateClick }) {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer un carnet";

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );
  const { value: portfolios } = usePortfolios({ filterByScopeId: scopeId });

  // effects

  useEffect(() => {
    if (displayedPortfolioId) return;
    if (!portfolios?.length) return;
    const first = portfolios[0];
    dispatch(setDisplayedPortfolioId(first.id));
    dispatch(setSelectedItem({ id: first.id, type: "PORTFOLIO" }));
  }, [displayedPortfolioId, portfolios, dispatch]);

  // render

  if (portfolios && portfolios.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 1,
        }}
      >
        <Button variant="contained" color="secondary" onClick={onCreateClick}>
          {createS}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 1 }}>
      <List dense disablePadding>
        {portfolios?.map((portfolio) => (
          <PortfolioTreeItem key={portfolio.id} portfolio={portfolio} />
        ))}
      </List>
    </Box>
  );
}
