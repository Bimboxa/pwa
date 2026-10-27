import {
  Box,
  Typography,
  ListItemButton,
  Tooltip,
  CircularProgress,
  Button,
  Collapse,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CloudQueue, ExpandMore, ExpandLess } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ChipProjectType from "./ChipProjectType";
import StackPovPreviews from "./StackPovPreviews";
import ListDashboardProjectScopes from "./ListDashboardProjectScopes";

import {
  CARD_BORDER,
  TEXT_FADED,
  PILL_BORDER,
  PILL_TEXT,
  PILL_HOVER_BG,
  PROJECTS_TABLE_COLUMNS,
  TABLE_ROW_BG_EXPANDED,
  fadeUp,
} from "../utils/dashboardStyles";

// One row of the projects table (TableDashboardProjects): name over type
// chip + number / city, POV previews, then the Krtos dropdown button that
// unfolds the project Krtos under the row. Clicking the row selects the
// project (detail panel on the right).

export default function ListItemDashboardProject({
  item,
  index,
  selected,
  installing,
  expanded,
  onClick,
  onToggleExpand,
}) {
  // data

  const appConfig = useAppConfig();

  // strings

  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";
  const scopesS = appConfig?.strings?.scope?.namePlural ?? "Dossiers";
  const noScopeS = appConfig?.strings?.scope?.noScope ?? "Aucun dossier";
  const notInstalledS =
    appConfig?.strings?.project?.notInstalledTooltip ??
    "Projet non installé sur cet appareil";

  // helpers

  const count = item.scopeCount ?? 0;
  const countText =
    count === 0 ? noScopeS : `${count} ${count > 1 ? scopesS : scopeS}`;

  const metaText = [item.clientRef, item.city].filter(Boolean).join(" · ");

  // staggered entrance, capped so long lists don't wait
  const entranceDelay = 0.3 + Math.min(index ?? 0, 10) * 0.05;

  // handlers

  function handleToggleExpand(e) {
    e.stopPropagation();
    onToggleExpand?.(item);
  }

  // render

  return (
    <Box
      sx={{
        borderBottom: `1px solid ${CARD_BORDER}`,
        "&:last-of-type": { borderBottom: "none" },
        bgcolor: expanded ? TABLE_ROW_BG_EXPANDED : "white",
        ...(index !== undefined && fadeUp(entranceDelay)),
      }}
    >
      <ListItemButton
        selected={selected}
        onClick={onClick}
        sx={{
          display: "grid",
          gridTemplateColumns: PROJECTS_TABLE_COLUMNS,
          alignItems: "center",
          columnGap: 1.5,
          px: 2,
          py: 1.25,
          transition: "background-color .15s",
          "&:hover": {
            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.03),
          },
          "&.Mui-selected": {
            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.07),
            boxShadow: (theme) =>
              `inset 3px 0 0 ${theme.palette.secondary.main}`,
            "&:hover": {
              bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.09),
            },
          },
        }}
      >
        {/* project */}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
              {item.name}
            </Typography>
            {!item.isLocal && !installing && (
              <Tooltip title={notInstalledS}>
                <CloudQueue
                  sx={{
                    color: "text.secondary",
                    fontSize: "1.05rem",
                    flexShrink: 0,
                  }}
                />
              </Tooltip>
            )}
            {installing && (
              <CircularProgress size={14} sx={{ color: "secondary.main" }} />
            )}
          </Box>
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}
          >
            <ChipProjectType type={item.type} />
            {metaText && (
              <Typography
                variant="caption"
                sx={{ color: "text.secondary" }}
                noWrap
              >
                {metaText}
              </Typography>
            )}
          </Box>
        </Box>

        {/* POV previews */}
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          {item.povPreviews?.length > 0 && (
            <StackPovPreviews povPreviews={item.povPreviews} />
          )}
        </Box>

        {/* Krtos dropdown */}
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="small"
            variant="outlined"
            disabled={count === 0}
            onClick={handleToggleExpand}
            onMouseDown={(e) => e.stopPropagation()}
            endIcon={
              count > 0 ? (
                expanded ? (
                  <ExpandLess sx={{ fontSize: "1.1rem !important" }} />
                ) : (
                  <ExpandMore sx={{ fontSize: "1.1rem !important" }} />
                )
              ) : null
            }
            sx={{
              height: 28,
              px: 1.25,
              minWidth: 0,
              borderRadius: 999,
              whiteSpace: "nowrap",
              fontSize: 12,
              fontWeight: 600,
              textTransform: "none",
              color: PILL_TEXT,
              borderColor: PILL_BORDER,
              bgcolor: "white",
              "& .MuiButton-endIcon": { ml: 0.25 },
              "&:hover": { bgcolor: PILL_HOVER_BG, borderColor: PILL_BORDER },
              ...(expanded && {
                color: "secondary.main",
                borderColor: (theme) =>
                  alpha(theme.palette.secondary.main, 0.5),
              }),
              "&.Mui-disabled": {
                color: TEXT_FADED,
                borderColor: CARD_BORDER,
                bgcolor: "transparent",
              },
            }}
          >
            {countText}
          </Button>
        </Box>
      </ListItemButton>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <ListDashboardProjectScopes item={item} />
      </Collapse>
    </Box>
  );
}
