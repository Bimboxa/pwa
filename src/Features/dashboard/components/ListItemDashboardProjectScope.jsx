import { Box, Typography, Tooltip } from "@mui/material";
import { CloudQueue } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import AvatarPovPreview from "./AvatarPovPreview";
import ChipsScopeStats from "./ChipsScopeStats";

// Compact krto row of the projects table dropdown: POV preview, name over
// "author, date", content stats (base maps / annotations). Clicking the row
// opens the krto. `row` = getDashboardScopeRows item.

export default function ListItemDashboardProjectScope({ row, onOpen }) {
  // data

  const appConfig = useAppConfig();

  // strings

  const notInstalledS =
    appConfig?.strings?.scope?.notInstalledTooltip ??
    "Dossier non installé sur cet appareil";
  const openS = appConfig?.strings?.scope?.openTooltip ?? "Ouvrir le dossier";

  // render

  return (
    <Tooltip title={openS} placement="left" enterDelay={600}>
      <Box
        onClick={() => onOpen(row)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          pl: 2,
          pr: 1.5,
          py: 0.75,
          minHeight: 44,
          cursor: "pointer",
          borderRadius: 1.5,
          "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
        }}
      >
        <Box sx={{ width: 34, flexShrink: 0, display: "flex" }}>
          <AvatarPovPreview povPreviews={row.povPreviews} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography sx={{ fontWeight: 500, fontSize: 13 }} noWrap>
              {row.name}
            </Typography>
            {!row.isLocal && (
              <Tooltip title={notInstalledS}>
                <CloudQueue
                  sx={{
                    color: "text.secondary",
                    fontSize: "1rem",
                    flexShrink: 0,
                  }}
                />
              </Tooltip>
            )}
          </Box>
          {row.subText && (
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", display: "block" }}
              noWrap
            >
              {row.subText}
            </Typography>
          )}
        </Box>
        <ChipsScopeStats
          baseMapsCount={row.baseMapsCount}
          annotationsCount={row.annotationsCount}
        />
      </Box>
    </Tooltip>
  );
}
