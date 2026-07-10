import { Box, Typography, List, CircularProgress } from "@mui/material";
import { Cloud } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ListItemDashboardProject from "./ListItemDashboardProject";

export default function SectionCloudSearchResults({
  cloudItems,
  loading,
  selectedKey,
  installingKey,
  onSelectItem,
}) {
  // data

  const appConfig = useAppConfig();

  // strings

  const titleS = appConfig?.strings?.scope?.onCloud ?? "Sur le cloud";

  // render

  if (!loading && !cloudItems?.length) return null;

  return (
    <Box sx={{ mt: 1 }}>
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
      <List disablePadding>
        {(cloudItems ?? []).map((item) => (
          <ListItemDashboardProject
            key={item.key}
            item={item}
            selected={item.key === selectedKey}
            installing={item.key === installingKey}
            onClick={() => onSelectItem(item)}
          />
        ))}
      </List>
    </Box>
  );
}
