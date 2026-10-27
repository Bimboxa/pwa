import { Box, Typography, Tooltip } from "@mui/material";
import { CloudQueue } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import AvatarPovPreview from "./AvatarPovPreview";
import ChipsScopeStats from "./ChipsScopeStats";

import { CARD_BORDER, PILL_HOVER_BG } from "../utils/dashboardStyles";

// Compact krto cell of the projects table dropdown: POV preview, name over
// "author, date", content stats (base maps / annotations). Clicking the row
// opens the krto. `row` = getDashboardScopeRows item. `showPreview` reserves
// the preview column (when at least one sibling row has a preview).

export default function ListItemDashboardProjectScope({
  row,
  showPreview,
  onOpen,
}) {
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
          px: 1.5,
          py: 0.75,
          minHeight: 48,
          cursor: "pointer",
          bgcolor: "white",
          borderBottom: `1px solid ${CARD_BORDER}`,
          "&:last-of-type": { borderBottom: "none" },
          transition: "background-color .15s",
          "&:hover": { bgcolor: PILL_HOVER_BG },
        }}
      >
        {showPreview && (
          <Box sx={{ width: 34, flexShrink: 0, display: "flex" }}>
            <AvatarPovPreview povPreviews={row.povPreviews} />
          </Box>
        )}
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
