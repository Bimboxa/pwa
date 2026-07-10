import { Box, Typography, Avatar, Tooltip, IconButton } from "@mui/material";
import { Folder, CloudQueue, Close } from "@mui/icons-material";

import ChipProjectType from "./ChipProjectType";
import { getProjectTypeProps } from "../utils/projectTypes";

export default function HeaderDashboardProject({ item, onClose }) {
  // helpers

  const { color } = getProjectTypeProps(item.type);
  const metaText = [
    item.clientRef ? `N° ${item.clientRef}` : null,
    item.city,
  ]
    .filter(Boolean)
    .join(" · ");

  // render

  return (
    <Box
      sx={{
        px: 3,
        pt: 3,
        pb: 2.5,
        bgcolor: "white",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar
          variant="rounded"
          sx={{ bgcolor: color + "18", color, width: 44, height: 44 }}
        >
          <Folder sx={{ fontSize: "1.4rem" }} />
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h5" noWrap>
              {item.name}
            </Typography>
            {!item.isLocal && (
              <Tooltip title="Projet non installé sur cet appareil">
                <CloudQueue sx={{ color: "text.secondary" }} />
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
            <ChipProjectType type={item.type} />
            {metaText && (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {metaText}
              </Typography>
            )}
          </Box>
        </Box>
        {onClose && (
          <Tooltip title="Quitter la sélection">
            <IconButton
              onClick={onClose}
              sx={{ alignSelf: "flex-start", color: "text.secondary" }}
            >
              <Close />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
