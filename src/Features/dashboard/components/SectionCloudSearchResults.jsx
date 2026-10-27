import { Box, Typography, CircularProgress } from "@mui/material";
import { Cloud } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import TableDashboardProjects from "./TableDashboardProjects";

export default function SectionCloudSearchResults({
  cloudItems,
  loading,
  selectedKey,
  installingKey,
  expandedKeys,
  onSelectItem,
  onToggleExpand,
}) {
  // data

  const appConfig = useAppConfig();

  // strings

  const titleS = appConfig?.strings?.scope?.onCloud ?? "Sur le cloud";

  // render

  if (!loading && !cloudItems?.length) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography
        variant="overline"
        sx={{
          color: "text.secondary",
          fontWeight: 700,
          px: 1,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
        }}
      >
        <Cloud sx={{ fontSize: "0.95rem" }} /> {titleS}
        {loading && <CircularProgress size={12} sx={{ ml: 0.5 }} />}
      </Typography>
      <TableDashboardProjects
        items={cloudItems}
        selectedKey={selectedKey}
        installingKey={installingKey}
        expandedKeys={expandedKeys}
        onSelectItem={onSelectItem}
        onToggleExpand={onToggleExpand}
        showHeader={false}
        animated={false}
      />
    </Box>
  );
}
