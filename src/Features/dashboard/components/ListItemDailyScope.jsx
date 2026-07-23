import { useSelector } from "react-redux";

import { Box, Typography, Button, Chip } from "@mui/material";

import parseBackendDate from "Features/date/utils/parseBackendDate";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import { getEffectiveOwner, normalizeOwnerId } from "App/db/ownership";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";

import { TEXT_FAINT } from "../utils/dashboardStyles";

// One row of the "daily scopes" list: project name over scope name on the
// left, author trigram + creation time on one line over an "open" button on
// the right. Private scopes created by another user get a "lecture seule"
// chip left of the trigram.

export default function ListItemDailyScope({ item, onOpen }) {
  // data

  const appConfig = useAppConfig();
  const localScope = useSelector(
    (s) => s.scopes.scopesById?.[item.scopeId]
  );
  const currentUserId = useSelector((s) =>
    getUserIdMaster(s.auth.userProfile)
  );

  // strings

  const openS = "Ouvrir";
  const readOnlyS = appConfig?.strings?.scope?.readOnlyChip ?? "lecture seule";

  // helpers

  // Local record authoritative once the scope is downloaded; before that,
  // fall back to the remote item fields (isPublic needs backend support).
  const isPublic = localScope
    ? localScope.isPublic === true
    : item.isPublic === true;
  const creatorId = localScope
    ? getEffectiveOwner(localScope)
    : normalizeOwnerId(item.createdBy?.idMaster);
  const showReadOnlyChip =
    !isPublic &&
    creatorId !== null &&
    creatorId !== normalizeOwnerId(currentUserId);

  const timeS =
    parseBackendDate(item.lastConfigurationAt)?.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }) ?? "";

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "white",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
          {item.projectName}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
          {item.scopeName}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 0.5,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
          {showReadOnlyChip && (
            <Chip
              label={readOnlyS}
              size="small"
              sx={{ height: 18, fontSize: 11 }}
            />
          )}
          <Typography sx={{ fontWeight: 600, fontSize: 13 }}>
            {item.createdBy?.trigram}
          </Typography>
          <Typography variant="caption" sx={{ color: TEXT_FAINT }}>
            {timeS}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onOpen?.(item)}
          sx={{ fontSize: 12, py: 0, px: 1.25, minWidth: 0 }}
        >
          {openS}
        </Button>
      </Box>
    </Box>
  );
}
