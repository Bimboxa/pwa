import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setDetailBaseMapId,
  setDetailView,
  setDisplayedBaseMapListingId,
  setCreatingInListingId,
  toggleVersionHidden,
} from "../baseMapEditorSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Link,
  Typography,
} from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import AddIcon from "@mui/icons-material/Add";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import DialogCreateBaseMapVersion from "./DialogCreateBaseMapVersion";
import IconButtonMoreActionsBaseMapVersion from "./IconButtonMoreActionsBaseMapVersion";

import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";
import createBaseMapVersionFromSource from "Features/baseMaps/services/createBaseMapVersionFromSource";
import formatVersionDate from "Features/baseMaps/utils/formatVersionDate";
import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";

// ---------------------------------------------------------------------------
// PanelBaseMapVersions — detail view of the Fond de plan panel (#312): the
// versions of one base map, with a breadcrumb header navigating back to the
// tree and a "Propriétés" button opening the properties subview — same
// pattern as PanelTemplateAnnotations in the Dessin panel (#311).
// ---------------------------------------------------------------------------

export default function PanelBaseMapVersions({ baseMap, listing }) {
  const dispatch = useDispatch();

  // strings

  const breadcrumbRootS = "Fonds de plan";
  const propertiesS = "Propriétés";
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

  const versionsCount = sortedVersions.length || 1;
  const countS = `${versionsCount} version${versionsCount > 1 ? "s" : ""}`;
  const subtitleS = listing?.name ? `${countS} · ${listing.name}` : countS;

  const { label: nameS, isPlaceholder: isUnnamed } =
    getBaseMapDisplayName(baseMap);

  // handlers

  const handleBack = () => {
    dispatch(setDetailBaseMapId(null));
  };

  // The base map properties open IN the panel (PanelBaseMapDetailProperties
  // subview), not in the right panel.
  const handleOpenProperties = () => {
    dispatch(setDetailView("PROPERTIES"));
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

      {/* Header: back + thumbnail + title */}
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, pb: 1 }}
      >
        <IconButton
          onClick={handleBack}
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            flexShrink: 0,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <ChevronLeft sx={{ fontSize: 20 }} />
        </IconButton>
        <Avatar
          src={baseMap?.getThumbnail?.() || baseMap?.image?.thumbnail}
          variant="rounded"
          sx={{ width: 36, height: 36, flexShrink: 0 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            noWrap
            sx={{
              fontWeight: 700,
              ...(isUnnamed && {
                fontStyle: "italic",
                color: "text.secondary",
              }),
            }}
          >
            {nameS}
          </Typography>
          <Typography variant="body2" noWrap sx={{ color: "text.secondary" }}>
            {subtitleS}
          </Typography>
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ display: "flex", gap: 1, px: 1.5, pb: 1.5 }}>
        <Button
          onClick={handleOpenProperties}
          sx={{
            flex: 1,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            color: "text.primary",
            fontWeight: 600,
            textTransform: "none",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {propertiesS}
        </Button>
      </Box>

      {/* Versions list */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
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
