import { useSelector } from "react-redux";

import { Box, Typography, CircularProgress } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useFetchProjectScopeConfigurations from "../hooks/useFetchProjectScopeConfigurations";
import useOpenDashboardScope from "../hooks/useOpenDashboardScope";

import ListItemDashboardProjectScope from "./ListItemDashboardProjectScope";

import getDashboardScopeRows from "../utils/getDashboardScopeRows";
import { TEXT_FADED } from "../utils/dashboardStyles";

// Krtos of a project, unfolded under its row in the projects table. Mounted
// only while unfolded: it fetches the project configurations from the server
// (ByProject), which also refreshes the Krto count of the row.

export default function ListDashboardProjectScopes({ item }) {
  // data

  const appConfig = useAppConfig();
  const { loading } = useFetchProjectScopeConfigurations(item);
  const userConfigurations = useSelector(
    (s) => s.remoteScopeConfigurations.userConfigurations
  );
  const projectConfigurations = useSelector(
    (s) => s.remoteScopeConfigurations.projectConfigurations
  );
  const openScope = useOpenDashboardScope();

  // strings

  const noScopeS = appConfig?.strings?.scope?.noScope ?? "Aucun dossier";

  // helpers

  const rows = getDashboardScopeRows({
    item,
    projectConfigurations,
    userConfigurations,
  });

  // handlers

  function handleOpen(row) {
    openScope({ row, projectId: item.projectId });
  }

  // render

  return (
    <Box sx={{ pl: 2, pr: 1, pb: 1 }}>
      {rows.map((row) => (
        <ListItemDashboardProjectScope
          key={row.scopeId}
          row={row}
          onOpen={handleOpen}
        />
      ))}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={16} sx={{ color: TEXT_FADED }} />
        </Box>
      )}
      {!loading && !rows.length && (
        <Typography
          variant="caption"
          sx={{ display: "block", color: TEXT_FADED, pl: 2, py: 1 }}
        >
          {noScopeS}
        </Typography>
      )}
    </Box>
  );
}
