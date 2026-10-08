import { useSelector } from "react-redux";

import { Box, Button, List } from "@mui/material";

import usePortfolios from "Features/portfolios/hooks/usePortfolios";
import useAutoSelectFirstPortfolio from "Features/portfolios/hooks/useAutoSelectFirstPortfolio";

import PortfolioTreeItem from "./PortfolioTreeItem";

export default function PortfolioTree({ onCreateClick }) {
  // strings

  const createS = "Créer un carnet";

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { value: portfolios } = usePortfolios({ filterByScopeId: scopeId });

  useAutoSelectFirstPortfolio(portfolios);

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
