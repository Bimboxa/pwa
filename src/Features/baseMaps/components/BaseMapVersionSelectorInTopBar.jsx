import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setVersionCompareEnabled,
  setVersionCompareId,
  resetVersionCompare,
} from "Features/baseMapEditor/baseMapEditorSlice";

import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Avatar,
  IconButton,
  Tooltip,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckIcon from "@mui/icons-material/Check";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";

// Split compare icon — two overlapping rectangles with a vertical divider
function IconSplitCompare({ active }) {
  return (
    <Box
      sx={{
        width: 20,
        height: 16,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Left rectangle (dark) */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 1,
          width: 11,
          height: 14,
          bgcolor: active ? "primary.main" : "grey.700",
          borderRadius: "2px",
        }}
      />
      {/* Right rectangle (lighter) */}
      <Box
        sx={{
          position: "absolute",
          right: 0,
          top: 1,
          width: 11,
          height: 14,
          bgcolor: active ? "primary.300" : "grey.400",
          borderRadius: "2px",
        }}
      />
      {/* Center divider line */}
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: "2px",
          bgcolor: active ? "primary.dark" : "grey.900",
          transform: "translateX(-50%)",
          zIndex: 1,
        }}
      />
    </Box>
  );
}

export default function BaseMapVersionSelectorInTopBar() {
  const dispatch = useDispatch();

  // data

  const baseMap = useMainBaseMap();
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const versionCompareEnabled = useSelector(
    (s) => s.baseMapEditor.versionCompareEnabled
  );
  const versionCompareId = useSelector(
    (s) => s.baseMapEditor.versionCompareId
  );

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const [compareAnchorEl, setCompareAnchorEl] = useState(null);
  const compareOpen = Boolean(compareAnchorEl);

  // helpers

  const versions = baseMap?.versions;
  const hasMultipleVersions = versions && versions.length > 1;
  const activeVersion = versions?.find((v) => v.isActive) || versions?.[0];
  const isBaseMapsViewer = viewerKey === "BASE_MAPS";

  const sortedVersions = useMemo(() => {
    if (!versions?.length) return [];
    return [...versions].sort((a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
    );
  }, [versions]);

  const otherVersions = useMemo(() => {
    return sortedVersions.filter((v) => v.id !== activeVersion?.id);
  }, [sortedVersions, activeVersion?.id]);

  const comparedVersion = versions?.find((v) => v.id === versionCompareId);

  // handlers

  function handleOpen(e) {
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleSelectVersion(version) {
    if (!baseMap?.id || version.isActive) return;
    if (versionCompareEnabled) {
      dispatch(resetVersionCompare());
    }
    await activateBaseMapVersion(baseMap.id, version.id, dispatch);
    handleClose();
  }

  function handleToggleCompare() {
    if (versionCompareEnabled) {
      dispatch(resetVersionCompare());
    } else if (otherVersions.length > 0) {
      dispatch(setVersionCompareEnabled(true));
      dispatch(setVersionCompareId(otherVersions[0].id));
    }
  }

  function handleOpenCompareDropdown(e) {
    e.stopPropagation();
    setCompareAnchorEl(e.currentTarget);
  }

  function handleCloseCompareDropdown() {
    setCompareAnchorEl(null);
  }

  function handleSelectCompareVersion(version) {
    dispatch(setVersionCompareId(version.id));
    handleCloseCompareDropdown();
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
        sx={{ color: "text.primary" }}
      />

      {/* Compare toggle + dropdown — only in BASE_MAPS viewer */}
      {isBaseMapsViewer && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            ml: 0.5,
            border: "1px solid",
            borderColor: versionCompareEnabled ? "grey.400" : "divider",
            borderRadius: 1.5,
            overflow: "hidden",
            height: 32,
          }}
        >
          {/* Split toggle button */}
          <Tooltip title="Comparer deux versions">
            <IconButton
              size="small"
              onClick={handleToggleCompare}
              sx={{
                borderRadius: 0,
                px: 1,
                height: "100%",
                color: versionCompareEnabled ? "grey.800" : "grey.500",
                bgcolor: versionCompareEnabled
                  ? "grey.200"
                  : "transparent",
                "&:hover": {
                  bgcolor: versionCompareEnabled
                    ? "grey.300"
                    : "action.hover",
                },
              }}
            >
              <IconSplitCompare active={versionCompareEnabled} />
            </IconButton>
          </Tooltip>

          {/* Dropdown arrow for compare version picker */}
          <IconButton
            size="small"
            onClick={handleOpenCompareDropdown}
            disabled={!versionCompareEnabled && otherVersions.length === 0}
            sx={{
              borderRadius: 0,
              borderLeft: "1px solid",
              borderColor: versionCompareEnabled ? "grey.300" : "divider",
              px: 0.5,
              height: "100%",
              color: versionCompareEnabled ? "grey.800" : "grey.500",
              "&:hover": {
                bgcolor: versionCompareEnabled
                  ? "grey.300"
                  : "action.hover",
              },
            }}
          >
            <ArrowDropDownIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Version selector popover */}
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

      {/* Compare version picker popover */}
      <Popover
        open={compareOpen}
        anchorEl={compareAnchorEl}
        onClose={handleCloseCompareDropdown}
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
            Comparer avec
          </Typography>
        </Box>

        <List dense sx={{ maxHeight: 300, overflowY: "auto", py: 0 }}>
          {otherVersions.map((version) => {
            const isCompared = version.id === versionCompareId;
            return (
              <ListItemButton
                key={version.id}
                onClick={() => handleSelectCompareVersion(version)}
                selected={isCompared}
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
                    fontWeight: isCompared ? 600 : 400,
                    noWrap: true,
                  }}
                />
                {isCompared && (
                  <CheckIcon
                    sx={{ color: "primary.main", fontSize: 18, ml: 1 }}
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
