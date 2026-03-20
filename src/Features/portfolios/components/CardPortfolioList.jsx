import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedViewerKey, setViewerReturnContext } from "Features/viewers/viewersSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";

import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";
import { Add, ChevronRight, MenuBook } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import usePortfolios from "Features/portfolios/hooks/usePortfolios";
import useCreatePortfolio from "Features/portfolios/hooks/useCreatePortfolio";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function CardPortfolioList() {
  const dispatch = useDispatch();

  // data

  const { value: selectedScope } = useSelectedScope();
  const scopeId = selectedScope?.id;
  const projectId = selectedScope?.projectId;
  const { value: portfolios } = usePortfolios({ filterByScopeId: scopeId });
  const createPortfolio = useCreatePortfolio();

  // state

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(getTodayString());
  const [author, setAuthor] = useState("");

  // handlers

  function handleOpenPortfolio(portfolioId) {
    dispatch(setDisplayedPortfolioId(portfolioId));
    dispatch(setViewerReturnContext({ fromViewer: "MAP" }));
    dispatch(setSelectedViewerKey("PORTFOLIO"));
  }

  function handleOpenDialog() {
    setName("");
    setDate(getTodayString());
    setAuthor("");
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    setDialogOpen(false);
  }

  async function handleConfirmCreate() {
    if (!scopeId || !projectId) return;
    const title = name.trim() || "Portfolio";
    const listing = await createPortfolio({
      scopeId,
      projectId,
      title,
      metadata: { date, author: author.trim() || undefined },
    });
    setDialogOpen(false);
    handleOpenPortfolio(listing.id);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 0.5,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Portfolios
        </Typography>
        <IconButton size="small" onClick={handleOpenDialog}>
          <Add fontSize="small" />
        </IconButton>
      </Box>

      {(!portfolios || portfolios.length === 0) && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          Aucun portfolio
        </Typography>
      )}

      {portfolios?.map((portfolio) => (
        <Box
          key={portfolio.id}
          onClick={() => handleOpenPortfolio(portfolio.id)}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 0.75,
            px: 0.5,
            cursor: "pointer",
            borderRadius: 1,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <MenuBook fontSize="small" color="action" />
            <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
              {portfolio.name || "Sans nom"}
            </Typography>
          </Box>
          <ChevronRight fontSize="small" color="action" />
        </Box>
      ))}

      {/* Dialog create portfolio */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Nouveau portfolio</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 3 }}>
          <TextField
            autoFocus
            label="Nom"
            size="small"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Date"
            type="date"
            size="small"
            fullWidth
            value={date}
            onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Auteur"
            size="small"
            fullWidth
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button variant="contained" onClick={handleConfirmCreate}>
            Créer
          </Button>
        </DialogActions>
      </Dialog>
    </WhiteSectionGeneric>
  );
}
