import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { togglePortfolioCollapsed } from "Features/portfolios/portfoliosSlice";

import {
  Box,
  Divider,
  InputBase,
  ListItemButton,
  ListItemText,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Check,
  Close,
  ExpandMore,
  ChevronRight,
} from "@mui/icons-material";

import IconButtonMoreActionsPortfolio from "./IconButtonMoreActionsPortfolio";
import SectionPortfolioPages from "./SectionPortfolioPages";

import usePortfolioPages from "Features/portfolioPages/hooks/usePortfolioPages";
import useAddPortfolioPage from "Features/portfolioPages/hooks/useAddPortfolioPage";

import db from "App/db/db";

export default function PortfolioTreeItem({ portfolio }) {
  const dispatch = useDispatch();

  // strings

  const newPageS = "Nouvelle page";

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );
  const collapsedPortfolioIds = useSelector(
    (s) => s.portfolios.collapsedPortfolioIds
  );
  const { value: pages } = usePortfolioPages({
    filterByPortfolioId: portfolio.id,
  });
  const addPage = useAddPortfolioPage({ portfolio, pages });

  // state

  const [isEditingPortfolio, setIsEditingPortfolio] = useState(false);
  const [tempName, setTempName] = useState("");

  // helpers

  const isDisplayed = displayedPortfolioId === portfolio.id;
  const isExpanded = !collapsedPortfolioIds.includes(portfolio.id);
  const isPortfolioSelected = selectedItems.some(
    (i) => i.id === portfolio.id && i.type === "PORTFOLIO"
  );

  // handlers

  function handleToggleCollapsed(e) {
    e.stopPropagation();
    dispatch(togglePortfolioCollapsed(portfolio.id));
  }

  function handlePortfolioClick() {
    if (isEditingPortfolio) return;
    dispatch(setDisplayedPortfolioId(portfolio.id));
    dispatch(setSelectedItem({ id: portfolio.id, type: "PORTFOLIO" }));
  }

  // handlers - edit title

  function handleStartEditPortfolio(e) {
    e?.stopPropagation?.();
    setIsEditingPortfolio(true);
    setTempName(portfolio.name);
  }

  async function handleConfirmEditPortfolio() {
    await db.listings.update(portfolio.id, { name: tempName });
    setIsEditingPortfolio(false);
  }

  function handleCancelEdit() {
    setIsEditingPortfolio(false);
  }

  // render

  return (
    <Box sx={{ mb: 1 }}>
      <ListItemButton
        onClick={handlePortfolioClick}
        sx={{
          pl: 2,
          py: 1.5,
          borderLeft: "3px solid",
          borderLeftColor: isPortfolioSelected
            ? "secondary.main"
            : "transparent",
        }}
      >
        <IconButton
          size="small"
          onClick={handleToggleCollapsed}
          sx={{ p: 0, mr: 0.5 }}
        >
          {isExpanded ? (
            <ExpandMore sx={{ fontSize: 20 }} />
          ) : (
            <ChevronRight sx={{ fontSize: 20 }} />
          )}
        </IconButton>
        {isEditingPortfolio ? (
          <InputBase
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleConfirmEditPortfolio();
              else if (e.key === "Escape") handleCancelEdit();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            sx={{ fontSize: "0.875rem", flex: 1 }}
          />
        ) : (
          <ListItemText
            primary={portfolio.name}
            slotProps={{
              primary: {
                variant: "body2",
                noWrap: true,
                fontWeight: isDisplayed ? "bold" : "normal",
              },
            }}
          />
        )}
        {isEditingPortfolio ? (
          <Box sx={{ display: "flex", ml: 1 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmEditPortfolio();
              }}
              sx={{ color: "success.main" }}
            >
              <Check fontSize="inherit" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelEdit();
              }}
              sx={{ color: "error.main" }}
            >
              <Close fontSize="inherit" />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", ml: 1 }}>
            <Tooltip title={newPageS}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  addPage();
                }}
                sx={{ color: "text.disabled" }}
              >
                <AddIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <IconButtonMoreActionsPortfolio
              portfolio={portfolio}
              onRename={handleStartEditPortfolio}
              size="small"
              sx={{ p: 0.25, color: "text.disabled" }}
            />
          </Box>
        )}
      </ListItemButton>

      {isExpanded && (
        <Box
          sx={{
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Divider />
          <SectionPortfolioPages portfolio={portfolio} />
        </Box>
      )}
    </Box>
  );
}
