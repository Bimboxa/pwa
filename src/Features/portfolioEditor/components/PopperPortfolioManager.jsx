import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Box,
  Button,
  Divider,
  IconButton,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMore from "@mui/icons-material/ExpandMore";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import UnfoldLess from "@mui/icons-material/UnfoldLess";
import UnfoldMore from "@mui/icons-material/UnfoldMore";
import { Check, Close } from "@mui/icons-material";

import DialogCreatePortfolio from "./DialogCreatePortfolio";
import MenuMoreActionsPortfolio from "./MenuMoreActionsPortfolio";
import SectionPortfolioPages from "./SectionPortfolioPages";

import usePortfolios from "Features/portfolios/hooks/usePortfolios";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useAutoSelectFirstPortfolio from "Features/portfolios/hooks/useAutoSelectFirstPortfolio";
import useCreatePortfolioFromDialog from "Features/portfolios/hooks/useCreatePortfolioFromDialog";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import useCanEditRecord from "App/hooks/useCanEditRecord";

import db from "App/db/db";
import { OwnershipError } from "App/db/ownership";

// ---------------------------------------------------------------------------
// PopperPortfolioManager — floating manager of the Carnet de plans module,
// shown at the top left of the viewport while the left panel is folded (the
// tree is unmounted then, so nothing else names the current portfolio or lets
// the user change it). Same shell as PopperBaseMapsList: draggable header,
// collapse toggle. The header IS the portfolio field: name (click = portfolio
// selector), "…" (rename inline / delete), chevron (selector); the body is
// the sortable pages list with its "Nouvelle page" row.
// ---------------------------------------------------------------------------

const POPPER_WIDTH = 290;

// Stops usePanelDrag (preventDefault + stopPropagation on mousedown) from
// swallowing the click / focus of the interactive header children.
const stopMouseDown = (e) => e.stopPropagation();

export default function PopperPortfolioManager() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Carnets de plans";
  const createS = "Créer un carnet";
  const newPortfolioS = "Nouveau carnet";
  const selectS = "Choisir un carnet";
  const moreS = "Actions";
  const collapseS = "Replier";
  const expandS = "Déplier";

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );
  const { value: portfolios } = usePortfolios({ filterByScopeId: scopeId });
  const { value: portfolio } = useDisplayedPortfolio();
  const createFromDialog = useCreatePortfolioFromDialog();
  const { guardEditRecord } = useCanEditRecord();

  useAutoSelectFirstPortfolio(portfolios);

  // state

  const [collapsed, setCollapsed] = useState(false);
  const [selectAnchor, setSelectAnchor] = useState(null);
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // helpers

  const hasNoPortfolio = !portfolios?.length;

  // handlers

  function handleSelectPortfolio(id) {
    setSelectAnchor(null);
    dispatch(setDisplayedPortfolioId(id));
    dispatch(setSelectedItem({ id, type: "PORTFOLIO" }));
  }

  function handleOpenCreate() {
    setSelectAnchor(null);
    setOpenCreate(true);
  }

  // handlers - rename

  function handleStartRename() {
    if (!portfolio || !guardEditRecord(portfolio)) return;
    setTempName(portfolio.name ?? "");
    setIsEditingName(true);
  }

  async function handleConfirmRename() {
    try {
      await db.listings.update(portfolio.id, { name: tempName });
    } catch (error) {
      if (!(error instanceof OwnershipError)) throw error;
    }
    setIsEditingName(false);
  }

  function handleCancelRename() {
    setIsEditingName(false);
  }

  // render

  return (
    <Paper
      elevation={4}
      data-capture-hide
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        width: POPPER_WIDTH,
        maxHeight: "calc(100% - 32px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 3,
        border: "1px solid",
        borderColor: "panel.border",
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging.current ? "none" : "transform 0.1s ease-out",
      }}
    >
      {/* Draggable header = the portfolio field. Only the drag icon and the
          empty gaps start a drag: every interactive child stops mousedown. */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 0.25,
          pr: 0.5,
          py: 0.75,
          bgcolor: "panel.headerBg",
          borderBottom: collapsed ? "none" : "1px solid",
          borderColor: "panel.border",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <DragIndicatorIcon
            fontSize="small"
            sx={{ color: "panel.textLight" }}
          />
        </Box>

        {hasNoPortfolio ? (
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: "panel.textPrimary", flex: 1 }}
          >
            {titleS}
          </Typography>
        ) : isEditingName ? (
          <>
            <InputBase
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onMouseDown={stopMouseDown}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleConfirmRename();
                else if (e.key === "Escape") handleCancelRename();
              }}
              autoFocus
              sx={{ fontSize: "0.875rem", fontWeight: 600, flex: 1 }}
            />
            <IconButton
              size="small"
              onMouseDown={stopMouseDown}
              onClick={handleConfirmRename}
              sx={{ color: "success.main", p: 0.25 }}
            >
              <Check fontSize="inherit" />
            </IconButton>
            <IconButton
              size="small"
              onMouseDown={stopMouseDown}
              onClick={handleCancelRename}
              sx={{ color: "error.main", p: 0.25 }}
            >
              <Close fontSize="inherit" />
            </IconButton>
          </>
        ) : (
          <>
            <Typography
              variant="body2"
              noWrap
              role="button"
              onMouseDown={stopMouseDown}
              onClick={(e) => setSelectAnchor(e.currentTarget)}
              sx={{
                flex: 1,
                minWidth: 0,
                fontWeight: 600,
                color: "panel.textPrimary",
                cursor: "pointer",
              }}
            >
              {portfolio?.name ?? ""}
            </Typography>
            <Tooltip title={moreS}>
              <IconButton
                size="small"
                onMouseDown={stopMouseDown}
                onClick={(e) => setMoreAnchor(e.currentTarget)}
                sx={{
                  p: 0.25,
                  borderRadius: 1,
                  color: "text.secondary",
                  bgcolor: moreAnchor ? "action.selected" : "action.hover",
                  "&:hover": { bgcolor: "action.selected" },
                }}
              >
                <MoreHoriz sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={selectS}>
              <IconButton
                size="small"
                onMouseDown={stopMouseDown}
                onClick={(e) => setSelectAnchor(e.currentTarget)}
                sx={{ color: "text.secondary", p: 0.25 }}
              >
                <ExpandMore sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </>
        )}

        <Tooltip title={collapsed ? expandS : collapseS}>
          <IconButton
            size="small"
            onMouseDown={stopMouseDown}
            onClick={() => setCollapsed((c) => !c)}
            sx={{ color: "panel.textLight", p: 0.25 }}
          >
            {collapsed ? (
              <UnfoldMore sx={{ fontSize: 16 }} />
            ) : (
              <UnfoldLess sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Body: pages of the displayed portfolio, or the create CTA */}
      {!collapsed && (
        <Box sx={{ overflow: "auto", flex: 1, bgcolor: "background.paper" }}>
          {hasNoPortfolio ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                py: 3,
              }}
            >
              <Button
                variant="contained"
                color="secondary"
                onClick={() => setOpenCreate(true)}
              >
                {createS}
              </Button>
            </Box>
          ) : (
            <SectionPortfolioPages
              portfolio={portfolio}
              indent={2}
              showAddPageRow
              dndIdSuffix="-popper"
            />
          )}
        </Box>
      )}

      {/* Portfolio selector (list mode, like the Dessin panel's listing field) */}
      <Menu
        anchorEl={selectAnchor}
        open={Boolean(selectAnchor)}
        onClose={() => setSelectAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: POPPER_WIDTH - 2,
              maxWidth: POPPER_WIDTH - 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        {portfolios?.map((p) => {
          const selected = p.id === displayedPortfolioId;
          return (
            <MenuItem
              key={p.id}
              selected={selected}
              onClick={() => handleSelectPortfolio(p.id)}
              sx={{
                py: 0.75,
                borderLeft: "3px solid",
                borderLeftColor: selected ? "secondary.main" : "transparent",
              }}
            >
              <ListItemText
                primaryTypographyProps={{
                  variant: "body2",
                  noWrap: true,
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {p.name}
              </ListItemText>
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem onClick={handleOpenCreate} sx={{ gap: 1, py: 0.75 }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <Add sx={{ fontSize: 18, color: "panel.textMuted" }} />
          </ListItemIcon>
          <ListItemText
            primaryTypographyProps={{
              variant: "body2",
              color: "panel.textMuted",
            }}
          >
            {newPortfolioS}
          </ListItemText>
        </MenuItem>
      </Menu>

      <MenuMoreActionsPortfolio
        anchorEl={moreAnchor}
        onClose={() => setMoreAnchor(null)}
        portfolio={portfolio}
        onRename={handleStartRename}
      />

      <DialogCreatePortfolio
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreate={createFromDialog}
      />
    </Paper>
  );
}
