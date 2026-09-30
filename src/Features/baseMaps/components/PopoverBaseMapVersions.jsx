import { useMemo } from "react";
import { useDispatch } from "react-redux";

import {
  Avatar,
  Box,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";

import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";

// ---------------------------------------------------------------------------
// PopoverBaseMapVersions — version picker of a base map (sorted by
// fractionalIndex, the active one checked). Used by the base maps list in
// the Viewer module, which has no BaseMapVersionSelectorInTopBar.
// ---------------------------------------------------------------------------

export default function PopoverBaseMapVersions({ baseMap, anchorEl, onClose }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Versions";
  const versionS = "Version";

  // helpers

  const versions = baseMap?.versions;
  const sortedVersions = useMemo(() => {
    if (!versions?.length) return [];
    return [...versions].sort((a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
    );
  }, [versions]);

  // handlers

  async function handleSelectVersion(version) {
    if (!baseMap?.id || version.isActive) {
      onClose?.();
      return;
    }
    await activateBaseMapVersion(baseMap.id, version.id, dispatch);
    onClose?.();
  }

  // render

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      transformOrigin={{ vertical: "top", horizontal: "center" }}
      slotProps={{
        paper: {
          sx: { width: 260, mt: 1, borderRadius: 2, overflow: "hidden" },
        },
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {titleS}
        </Typography>
      </Box>
      <List dense sx={{ maxHeight: 300, overflowY: "auto", py: 0 }}>
        {sortedVersions.map((version) => {
          const isActive = version.isActive;
          return (
            <ListItemButton
              key={version.id}
              onClick={() => handleSelectVersion(version)}
              selected={isActive}
              sx={{ py: 0.75 }}
            >
              <Avatar
                src={version.image?.thumbnail}
                variant="rounded"
                sx={{ width: 24, height: 24, mr: 1.5 }}
              />
              <ListItemText
                primary={version.label || versionS}
                primaryTypographyProps={{
                  variant: "body2",
                  fontWeight: isActive ? 600 : 400,
                  noWrap: true,
                }}
              />
              {isActive && (
                <CheckIcon
                  sx={{ color: "text.secondary", fontSize: 18, ml: 1 }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>
    </Popover>
  );
}
