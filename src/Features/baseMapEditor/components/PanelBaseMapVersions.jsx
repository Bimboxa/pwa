import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setDetailBaseMapId,
  setDisplayedBaseMapListingId,
  setCreatingInListingId,
  toggleVersionHidden,
} from "../baseMapEditorSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import {
  triggerBaseMapsUpdate,
  setPropertiesRequestedView,
} from "Features/baseMaps/baseMapsSlice";

import {
  Avatar,
  Box,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Link,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import DialogCreateBaseMapVersion from "./DialogCreateBaseMapVersion";
import IconButtonMoreActionsBaseMapVersion from "./IconButtonMoreActionsBaseMapVersion";

import db from "App/db/db";
import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";
import createBaseMapVersionFromSource from "Features/baseMaps/services/createBaseMapVersionFromSource";
import formatVersionDate from "Features/baseMaps/utils/formatVersionDate";
import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";
import getBaseMapTransform, {
  DEFAULT_ORIENTATION,
} from "Features/baseMaps/js/getBaseMapTransform";

// ---------------------------------------------------------------------------
// PanelBaseMapVersions — detail view of the Fond de plan panel (#312): one
// base map, with a breadcrumb header navigating back to the tree, a full
// width image preview, the versions list and a "Position 3D" section
// (Horizontal / Vertical toggle + a "..." button opening the 3D
// localization panel in the right panel).
// ---------------------------------------------------------------------------

export default function PanelBaseMapVersions({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const breadcrumbRootS = "Fonds de plan";
  const versionsS = "Versions";
  const position3dS = "Position 3D";
  const openPosition3dS = "Localisation 3D";
  const newVersionS = "Nouvelle version";
  const legacyImageS = "Image d'origine";

  // data

  const selectedVersionId = useSelector(
    (s) => s.baseMapEditor.selectedVersionId
  );
  const hiddenVersionIds = useSelector((s) => s.baseMapEditor.hiddenVersionIds);

  // state

  const [openCreateVersion, setOpenCreateVersion] = useState(false);

  // helpers

  const sortedVersions = useMemo(
    () =>
      [...(baseMap.versions ?? [])].sort((a, b) =>
        (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
      ),
    [baseMap.versions]
  );

  const { label: nameS, isPlaceholder: isUnnamed } =
    getBaseMapDisplayName(baseMap);

  const previewUrl = baseMap?.getUrl?.() || baseMap?.image?.imageUrlClient;

  const orientation =
    getBaseMapTransform(baseMap)?.orientation ?? DEFAULT_ORIENTATION;

  // handlers

  const handleBack = () => {
    dispatch(setDetailBaseMapId(null));
  };

  // Same behavior as the tree's inline version rows (BaseMapTreeItem
  // handleVersionClick): select the base map and activate the version.
  async function handleVersionClick(version) {
    dispatch(setDisplayedBaseMapListingId(baseMap.listingId));
    dispatch(setSelectedBaseMapsListingId(baseMap.listingId));
    dispatch(setSelectedMainBaseMapId(baseMap.id));
    dispatch(setCreatingInListingId(null));
    dispatch(
      setSelectedItem({
        id: version.id,
        type: "BASE_MAP_VERSION",
        listingId: baseMap.listingId,
        baseMapId: baseMap.id,
      })
    );
    await activateBaseMapVersion(baseMap.id, version.id, dispatch);
  }

  async function handleCreateVersion({ label, sourceVersion }) {
    await createBaseMapVersionFromSource({
      targetBaseMap: baseMap,
      label,
      sourceVersion,
    });
    setOpenCreateVersion(false);
  }

  // Orientation of the plane in the 3D scene — same field / update as
  // PanelBaseMapPositionInMainRef.
  async function handleOrientationChange(value) {
    if (!baseMap?.id || !value || value === orientation) return;
    await db.baseMaps.update(baseMap.id, { orientation: value });
    dispatch(triggerBaseMapsUpdate());
  }

  // Open the 3D localization panel (PanelBaseMapProperties "position3d"
  // subview) in the RIGHT panel, targeting this base map.
  function handleOpenPosition3d() {
    dispatch(
      setSelectedItem({
        id: baseMap.id,
        type: "BASE_MAP",
        listingId: baseMap.listingId,
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
    dispatch(setPropertiesRequestedView("position3d"));
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
      }}
    >
      {/* Breadcrumb */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 2,
          pt: 1.5,
          pb: 1,
        }}
      >
        <Link
          component="button"
          underline="always"
          onClick={handleBack}
          sx={{ color: "text.secondary", fontSize: "0.875rem" }}
        >
          {breadcrumbRootS}
        </Link>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          /
        </Typography>
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 600, ...(isUnnamed && { fontStyle: "italic" }) }}
        >
          {nameS}
        </Typography>
      </Box>

      {/* Title */}
      <Typography
        variant="h6"
        noWrap
        sx={{
          px: 2,
          pb: 1,
          fontWeight: 700,
          ...(isUnnamed && {
            fontStyle: "italic",
            color: "text.secondary",
          }),
        }}
      >
        {nameS}
      </Typography>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* Full width image preview */}
        {previewUrl && (
          <Box sx={{ px: 1.5, pb: 1.5 }}>
            <Box
              component="img"
              src={previewUrl}
              sx={{
                width: 1,
                maxHeight: 220,
                objectFit: "contain",
                display: "block",
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
              }}
            />
          </Box>
        )}

        {/* Versions */}
        <Typography
          variant="caption"
          sx={{
            display: "block",
            px: 2,
            pb: 0.5,
            fontWeight: 700,
            color: "text.secondary",
          }}
        >
          {versionsS}
        </Typography>
        <Box
          sx={{
            bgcolor: "background.paper",
            borderTop: "1px solid",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <List dense disablePadding>
            {sortedVersions.length === 0 ? (
              // Legacy base map without version records: its image is the
              // only (implicit) version.
              <ListItemButton disableRipple sx={{ cursor: "default" }}>
                <Avatar
                  src={baseMap?.image?.thumbnail}
                  variant="rounded"
                  sx={{ width: 28, height: 28, mr: 1.5 }}
                />
                <ListItemText
                  primary={legacyImageS}
                  secondary={formatVersionDate(baseMap.createdAt)}
                  slotProps={{
                    primary: { variant: "body2", noWrap: true },
                    secondary: { variant: "caption" },
                  }}
                />
              </ListItemButton>
            ) : (
              sortedVersions.map((version) => {
                const isHidden = hiddenVersionIds?.includes(version.id);
                return (
                  <ListItemButton
                    key={version.id}
                    selected={selectedVersionId === version.id}
                    onClick={() => handleVersionClick(version)}
                    sx={{
                      "&:hover .version-eye": { opacity: 1 },
                      "&:hover .version-more": { opacity: 1 },
                    }}
                  >
                    <Avatar
                      src={version.image?.thumbnail}
                      variant="rounded"
                      sx={{
                        width: 28,
                        height: 28,
                        mr: 1.5,
                        opacity: isHidden ? 0.3 : 1,
                      }}
                    />
                    <ListItemText
                      primary={version.label}
                      secondary={formatVersionDate(version.createdAt)}
                      slotProps={{
                        primary: {
                          variant: "body2",
                          noWrap: true,
                          color: isHidden ? "text.disabled" : "text.primary",
                          fontWeight: version.isActive ? "bold" : "normal",
                        },
                        secondary: { variant: "caption" },
                      }}
                    />
                    {version.isActive && (
                      <Chip
                        label="Active"
                        size="small"
                        color="primary"
                        sx={{ height: 18, fontSize: "0.65rem", mr: 0.5 }}
                      />
                    )}
                    <IconButton
                      size="small"
                      className="version-eye"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch(toggleVersionHidden(version.id));
                      }}
                      sx={{
                        opacity: isHidden ? 1 : 0,
                        transition: "0.2s",
                        p: 0.25,
                      }}
                    >
                      {isHidden ? (
                        <VisibilityOff sx={{ fontSize: 14 }} color="disabled" />
                      ) : (
                        <Visibility sx={{ fontSize: 14 }} />
                      )}
                    </IconButton>
                    <IconButtonMoreActionsBaseMapVersion
                      baseMap={baseMap}
                      version={version}
                      className="version-more"
                      sx={{ opacity: 0, transition: "0.2s", p: 0.25 }}
                    />
                  </ListItemButton>
                );
              })
            )}
          </List>
        </Box>

        {/* New version */}
        <ListItemButton
          onClick={() => setOpenCreateVersion(true)}
          sx={{ gap: 1, color: "text.disabled" }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 1,
              border: "1.5px dashed",
              borderColor: "divider",
            }}
          >
            <AddIcon sx={{ fontSize: 16, color: "text.disabled" }} />
          </Box>
          <Typography variant="body2" color="text.disabled">
            {newVersionS}
          </Typography>
        </ListItemButton>

        {/* Position 3D */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 2,
            pt: 1.5,
            pb: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{ flex: 1, fontWeight: 700, color: "text.secondary" }}
          >
            {position3dS}
          </Typography>
          <Tooltip title={openPosition3dS}>
            <IconButton size="small" onClick={handleOpenPosition3d}>
              <MoreHoriz fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box
          sx={{
            px: 1.5,
            pb: 1.5,
          }}
        >
          <Box
            sx={{
              p: 1,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={orientation}
              onChange={(_e, v) => handleOrientationChange(v)}
            >
              <ToggleButton
                value="HORIZONTAL"
                sx={{ textTransform: "none", py: 0.25 }}
              >
                Horizontal
              </ToggleButton>
              <ToggleButton
                value="VERTICAL"
                sx={{ textTransform: "none", py: 0.25 }}
              >
                Vertical
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Box>

      {openCreateVersion && (
        <DialogCreateBaseMapVersion
          open={openCreateVersion}
          onClose={() => setOpenCreateVersion(false)}
          onConfirm={handleCreateVersion}
        />
      )}
    </Box>
  );
}
