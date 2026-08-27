import { useState } from "react";

import {
  Box,
  Typography,
  Avatar,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Folder,
  CloudQueue,
  Close,
  AddLink,
  MoreHoriz,
  SwapHoriz,
  LinkOff,
  Edit,
  DeleteOutline,
} from "@mui/icons-material";

import ChipProjectType from "./ChipProjectType";
import { getProjectTypeProps } from "../utils/projectTypes";

export default function HeaderDashboardProject({
  item,
  onClose,
  onLink,
  onDetach,
  onRename,
  onDeleteLocalData,
}) {
  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // strings

  const linkS = "Relier à un chantier / opportunité";
  const changeS = "Changer de chantier / opportunité";
  const detachS = "Détacher du référentiel";
  const renameS = "Renommer / changer le numéro";
  const deleteLocalDataS = "Supprimer les données locales";

  // helpers

  const { color } = getProjectTypeProps(item.type);
  const metaText = [item.clientRef ? `N° ${item.clientRef}` : null, item.city]
    .filter(Boolean)
    .join(" · ");

  // link/detach actions only make sense on installed (local) projects,
  // and only when the dashboard wires the handlers (référentiel configured)
  const canManageLink = Boolean(item.isLocal && item.projectId && onLink);
  const isLinked = Boolean(item.idMaster);
  // rename only makes sense on free (unlinked) local projects — a linked
  // project takes its name / num from the référentiel
  const canRename = Boolean(
    item.isLocal && item.projectId && !isLinked && onRename
  );
  // local-data wipe makes sense on any installed project — a linked one
  // remains re-installable from the référentiel afterwards
  const canDeleteLocalData = Boolean(
    item.isLocal && item.projectId && onDeleteLocalData
  );

  // handlers

  function handleMenuItemClick(action) {
    setMenuAnchor(null);
    action();
  }

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
        {(canManageLink || canRename || canDeleteLocalData) && (
          <>
            <Tooltip title="Plus d'actions">
              <IconButton
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ alignSelf: "flex-start", color: "text.secondary" }}
              >
                <MoreHoriz />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              {!isLinked && canManageLink && (
                <MenuItem onClick={() => handleMenuItemClick(onLink)}>
                  <ListItemIcon>
                    <AddLink fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{linkS}</ListItemText>
                </MenuItem>
              )}
              {canRename && (
                <MenuItem onClick={() => handleMenuItemClick(onRename)}>
                  <ListItemIcon>
                    <Edit fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{renameS}</ListItemText>
                </MenuItem>
              )}
              {isLinked && (
                <MenuItem onClick={() => handleMenuItemClick(onLink)}>
                  <ListItemIcon>
                    <SwapHoriz fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{changeS}</ListItemText>
                </MenuItem>
              )}
              {isLinked && onDetach && (
                <MenuItem onClick={() => handleMenuItemClick(onDetach)}>
                  <ListItemIcon>
                    <LinkOff fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{detachS}</ListItemText>
                </MenuItem>
              )}
              {canDeleteLocalData && (
                <MenuItem
                  onClick={() => handleMenuItemClick(onDeleteLocalData)}
                  sx={{ color: "error.main" }}
                >
                  <ListItemIcon sx={{ color: "inherit" }}>
                    <DeleteOutline fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{deleteLocalDataS}</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </>
        )}
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
