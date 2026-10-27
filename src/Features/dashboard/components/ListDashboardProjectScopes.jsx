import { useSelector } from "react-redux";

import { Box, Typography, CircularProgress } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useFetchProjectScopeConfigurations from "../hooks/useFetchProjectScopeConfigurations";
import useOpenDashboardScope from "../hooks/useOpenDashboardScope";

import ListItemDashboardProjectScope from "./ListItemDashboardProjectScope";

import getDashboardScopeRows from "../utils/getDashboardScopeRows";
import { CARD_BORDER, TEXT_FADED } from "../utils/dashboardStyles";

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

  const showPreview = rows.some((row) => row.povPreviews?.length > 0);

  // handlers

  function handleOpen(row) {
    openScope({ row, projectId: item.projectId });
  }

  // render

  return (
    <Box sx={{ pl: 4, pr: 2, pb: 1.5 }}>
      {rows.length > 0 && (
        <Box
          sx={{
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 1.5,
            overflow: "hidden",
          }}
        >
          {rows.map((row) => (
            <ListItemDashboardProjectScope
              key={row.scopeId}
              row={row}
              showPreview={showPreview}
              onOpen={handleOpen}
            />
          ))}
        </Box>
      )}
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
