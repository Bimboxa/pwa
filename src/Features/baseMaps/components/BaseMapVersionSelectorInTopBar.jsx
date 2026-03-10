import { useMemo, useState } from "react";

import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Avatar,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckIcon from "@mui/icons-material/Check";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import db from "App/db/db";

export default function BaseMapVersionSelectorInTopBar() {
  // data

  const baseMap = useMainBaseMap();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const versions = baseMap?.versions;
  const hasMultipleVersions = versions && versions.length > 1;
  const activeVersion = versions?.find((v) => v.isActive) || versions?.[0];

  const sortedVersions = useMemo(() => {
    if (!versions?.length) return [];
    return [...versions].sort((a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
    );
  }, [versions]);

  // handlers

  function handleOpen(e) {
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleSelectVersion(version) {
    if (!baseMap?.id || version.isActive) return;
    const record = await db.baseMaps.get(baseMap.id);
    if (!record?.versions) return;
    const updatedVersions = record.versions.map((v) => ({
      ...v,
      isActive: v.id === version.id,
    }));
    await db.baseMaps.update(baseMap.id, { versions: updatedVersions });
    handleClose();
  }

  // render

  if (!hasMultipleVersions) return null;

  return (
    <>
      <ButtonGeneric
        label={activeVersion?.label || "Version"}
        size="small"
        endIcon={<KeyboardArrowDownIcon />}
        onClick={handleOpen}
        sx={{ color: "grey.500" }}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              width: 260,
              mt: 1,
              borderRadius: 2,
              overflow: "hidden",
            },
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
            Versions
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
                  primary={version.label || "Version"}
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
    </>
  );
}
