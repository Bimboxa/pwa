import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box, List } from "@mui/material";

import usePortfolios from "Features/portfolios/hooks/usePortfolios";

import PortfolioTreeItem from "./PortfolioTreeItem";

export default function PortfolioTree() {
  const dispatch = useDispatch();

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
