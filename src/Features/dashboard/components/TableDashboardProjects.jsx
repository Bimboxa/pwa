import { Box, Typography } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ListItemDashboardProject from "./ListItemDashboardProject";

import {
  CARD_BORDER,
  TEXT_FAINT,
  PROJECTS_TABLE_COLUMNS,
} from "../utils/dashboardStyles";

// Projects of the dashboard as a table: optional header row, then one
// ListItemDashboardProject row per item. Expanded rows unfold their Krtos.

export default function TableDashboardProjects({
  items,
  selectedKey,
  installingKey,
  expandedKeys,
  onSelectItem,
  onToggleExpand,
  showHeader = true,
  animated = true,
}) {
  // data

  const appConfig = useAppConfig();

  // strings

  const projectS = appConfig?.strings?.project?.nameSingular ?? "Projet";
  const scopesS = appConfig?.strings?.scope?.namePlural ?? "Dossiers";

  // render

  if (!items?.length) return null;

  const headerCellSx = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: TEXT_FAINT,
  };

  return (
    <Box
      sx={{
        bgcolor: "white",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(28,27,26,.04)",
      }}
    >
      {showHeader && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: PROJECTS_TABLE_COLUMNS,
            columnGap: 1.5,
            px: 2,
            py: 1,
            borderBottom: `1px solid ${CARD_BORDER}`,
            bgcolor: "#FCFAF9",
          }}
        >
          <Typography sx={headerCellSx}>{projectS}</Typography>
          <Box />
          <Typography sx={{ ...headerCellSx, textAlign: "right", pr: 1 }}>
            {scopesS}
          </Typography>
        </Box>
      )}
      {items.map((item, index) => (
        <ListItemDashboardProject
          key={item.key}
          item={item}
          index={animated ? index : undefined}
          selected={item.key === selectedKey}
          installing={item.key === installingKey}
          expanded={expandedKeys?.has(item.key) ?? false}
          onClick={() => onSelectItem(item)}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </Box>
  );
}
