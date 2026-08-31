import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  toggleBaseMapVisibleIn3d,
  setBaseMapAnnotationsModeIn3d,
  toggleMainBaseMapImageIn3d,
  toggleMainBaseMapAnnotationsIn3d,
} from "Features/threedEditor/threedEditorSlice";
import {
  setHideBaseMapImageInViewer,
  togglePinnedBaseMapIdInViewer,
} from "Features/viewers/viewersSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import {
  Avatar,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import LayersIcon from "@mui/icons-material/Layers";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectMainBaseMap from "Features/threedEditor/hooks/useSelectMainBaseMap";
import useAnnotationsCountByBaseMapId from "Features/annotations/hooks/useAnnotationsCountByBaseMapId";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";
import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";
import { ANNOTATIONS_DISPLAY_MODE } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";

// Floating chips row pinned to the top-center of the 3D viewer — one chip per
// project basemap: a layer icon (image visibility state, click toggles the
// IMAGE in 3D), the basemap name, and a rounded badge with the annotations
// count (click toggles the ANNOTATIONS in 3D). Clicking the chip itself,
// outside those two buttons, selects the basemap as the main one (top-bar
// BaseMapSelector) — same as clicking its image in the 3D scene
// (MainThreedEditor.handleClick). The scene sync is already handled by
// useApplyBaseMapVisibilityIn3d / ThreedAnnotationsVisibility.
//
// `inTopBar` renders the row in flow (no absolute pinning) so it can live in
// the top bar — used by the POV viewer, where nothing may float over the
// capture frame mask.
//
// Whatever the module, the band prioritizes the annotated baseMaps: a chip
// shows for a baseMap having annotations, pinned, main, or whose image is
// currently shown in 3D; a trailing "…" chip lists the annotation-less
// baseMaps to pin/unpin them (pinning only adds the chip, the chip's eye
// then drives the 3D visibility as usual).
export default function TopBaseMapChipsThreed({ inTopBar = false }) {
  const dispatch = useDispatch();

  // data

  const { value: baseMaps = [] } = useBaseMaps();
  const mainBaseMap = useMainBaseMap();
  const selectMainBaseMap = useSelectMainBaseMap();
  const annotationsCountByBaseMapId = useAnnotationsCountByBaseMapId();
  const { disabledListingIds } = useDisabledBaseMapListingIds();
  const visibleIds = useSelector((s) => s.threedEditor.visibleBaseMapIdsIn3d);
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const hideMainImage = useSelector(
    (s) => s.threedEditor.hideMainBaseMapImageIn3d
  );
  const hideMainAnnotations = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );
  const isViewerModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "THREED"
  );
  // BaseMap module in 3D: the drawing annotations are not loaded (the scene
  // shows the isForBaseMaps ones), so the annotations badge/toggle is moot —
  // unless the panel's "Afficher les annotations" switch loads them.
  const isBaseMapsModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "BASE_MAPS"
  );
  const showAnnotationsInBaseMaps = useSelector(
    (s) => s.baseMapEditor.showAnnotations
  );
  const hideAnnotationsBadge = isBaseMapsModule && !showAnnotationsInBaseMaps;
  const pinnedIds = useSelector((s) => s.viewers.pinnedBaseMapIdsInViewer);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const hideBaseMapImageInViewer = useSelector(
    (s) => s.viewers.hideBaseMapImageInViewer
  );

  // state

  const [moreMenuAnchorEl, setMoreMenuAnchorEl] = useState(null);
  const [versionsAnchorEl, setVersionsAnchorEl] = useState(null);

  // helpers

  // Viewer module displaying its 2D editor: the selected chip goes solid
  // black, its eye hides the image in the 2D editor, and it embeds a version
  // selector; the other chips lose their (3D-only) eye.
  const isViewer2d = isViewerModule && effectiveViewerKey === "MAP";

  // Per-scope disabled listings leave the band and the "…" pin menu — except
  // the current main baseMap, whose chip hosts the eye/version controls and
  // must stay reachable while its image is on screen.
  const enabledBaseMaps = baseMaps.filter(
    (m) => !disabledListingIds.includes(m.listingId) || m.id === mainBaseMap?.id
  );

  // Whatever the module, the band prioritizes the annotated baseMaps: the
  // annotation-less ones are relegated to the "…" pin menu — except when they
  // must stay reachable (main, pinned, or image currently shown in 3D).
  const displayedBaseMaps = enabledBaseMaps.filter(
    (m) =>
      (annotationsCountByBaseMapId[m.id] ?? 0) > 0 ||
      pinnedIds.includes(m.id) ||
      m.id === mainBaseMap?.id ||
      visibleIds.includes(m.id)
  );
  const annotationLessBaseMaps = enabledBaseMaps.filter(
    (m) => !(annotationsCountByBaseMapId[m.id] > 0)
  );

  const mainVersions = mainBaseMap?.versions;
  const sortedMainVersions = useMemo(() => {
    if (!mainVersions?.length) return [];
    return [...mainVersions].sort((a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
    );
  }, [mainVersions]);

  // handlers

  // Shared with the 3D scene's double-click on a plan (MainThreedEditor):
  // the eye-state transfer across the main swap lives in the hook.
  function handleSelect(map) {
    selectMainBaseMap(map.id);
  }

  function handleToggleImage(e, map, isMain) {
    e.stopPropagation();
    if (isViewer2d) {
      // 2D editor: the selected chip's eye hides the image entirely.
      dispatch(setHideBaseMapImageInViewer(!hideBaseMapImageInViewer));
    } else if (isMain) {
      dispatch(toggleMainBaseMapImageIn3d());
    } else {
      dispatch(toggleBaseMapVisibleIn3d(map.id));
    }
  }

  function handleOpenVersions(e) {
    e.stopPropagation();
    setVersionsAnchorEl(e.currentTarget);
  }

  async function handleSelectVersion(version) {
    if (!mainBaseMap?.id || version.isActive) {
      setVersionsAnchorEl(null);
      return;
    }
    await activateBaseMapVersion(mainBaseMap.id, version.id, dispatch);
    setVersionsAnchorEl(null);
  }

  function handleToggleAnnotations(e, map, isMain, annotationsOn) {
    e.stopPropagation();
    if (isMain) {
      dispatch(toggleMainBaseMapAnnotationsIn3d());
    } else {
      dispatch(
        setBaseMapAnnotationsModeIn3d({
          baseMapId: map.id,
          mode: annotationsOn
            ? ANNOTATIONS_DISPLAY_MODE.NONE
            : ANNOTATIONS_DISPLAY_MODE.NORMAL,
        })
      );
    }
  }

  // render

  if (baseMaps.length === 0) return null;

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={
        inTopBar
          ? {
              maxWidth: "40vw",
              overflowX: "auto",
              p: 0.5,
            }
          : {
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              maxWidth: "80%",
              overflowX: "auto",
              zIndex: 10,
              p: 0.5,
            }
      }
    >
      {displayedBaseMaps.map((map) => {
        const isMain = map.id === mainBaseMap?.id;
        // Viewer 2D: the selected chip is solid black and its eye drives the
        // 2D editor image; the (3D-only) eye is hidden on the other chips.
        const isBlackChip = isViewer2d && isMain;
        const imageOn = isViewer2d
          ? !hideBaseMapImageInViewer
          : isMain
            ? !hideMainImage
            : visibleIds.includes(map.id);
        const annotationsMode =
          annotationsModeByBaseMapId?.[map.id] ?? ANNOTATIONS_DISPLAY_MODE.NONE;
        const annotationsOn = isMain
          ? !hideMainAnnotations
          : annotationsMode !== ANNOTATIONS_DISPLAY_MODE.NONE;
        const annotationsCount = annotationsCountByBaseMapId[map.id] ?? 0;
        const showImageEye = !isViewer2d || isMain;
        const versions = map.versions ?? [];
        const showVersionSelector = isBlackChip && versions.length > 1;
        const activeVersion = showVersionSelector
          ? versions.find((v) => v.isActive) || versions[0]
          : null;
        return (
          <Stack
            key={map.id}
            direction="row"
            alignItems="center"
            spacing={0.75}
            onClick={() => handleSelect(map)}
            sx={{
              flexShrink: 0,
              // The main basemap's chip carries a thicker outline; the padding
              // gives the extra pixel back so the row doesn't shift on select.
              px: isMain ? "9px" : "10px",
              py: isMain ? "3px" : "4px",
              borderRadius: "16px",
              border: isMain ? "2px solid" : "1px solid",
              borderColor: isBlackChip
                ? "common.black"
                : isMain
                  ? "primary.main"
                  : "divider",
              bgcolor: isBlackChip ? "common.black" : "background.paper",
              boxShadow: 2,
              cursor: "pointer",
            }}
          >
            {/* Layer icon = image visibility state: white-on-grey when the
                image shows, grey-on-white when hidden. Tooltips are kept on
                disjoint zones (icon / name / badge) so they never stack. */}
            {showImageEye && (
              <Tooltip
                title={
                  isViewer2d
                    ? imageOn
                      ? "Masquer l'image du fond de plan"
                      : "Afficher l'image du fond de plan"
                    : imageOn
                      ? "Masquer l'image dans la vue 3D"
                      : "Afficher l'image dans la vue 3D"
                }
                disableInteractive
              >
                <Box
                  onClick={(e) => handleToggleImage(e, map, isMain)}
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: imageOn ? "secondary.main" : "common.white",
                    color: imageOn
                      ? "secondary.contrastText"
                      : isBlackChip
                        ? "grey.600"
                        : "grey.500",
                    border: "1px solid",
                    borderColor: imageOn ? "transparent" : "divider",
                    cursor: "pointer",
                  }}
                >
                  <LayersIcon sx={{ fontSize: 14 }} />
                </Box>
              </Tooltip>
            )}
            <Tooltip
              title={isMain ? "" : "Sélectionner ce fond de plan"}
              disableInteractive
            >
              <Typography
                variant="body2"
                noWrap
                sx={{
                  maxWidth: 160,
                  fontWeight: isMain ? 700 : 400,
                  color: isBlackChip
                    ? "common.white"
                    : isMain
                      ? "primary.main"
                      : "text.primary",
                }}
              >
                {map.name}
              </Typography>
            </Tooltip>
            {showVersionSelector && (
              <Tooltip title="Changer de version" disableInteractive>
                <Box
                  onClick={handleOpenVersions}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.25,
                    px: 0.75,
                    py: 0.125,
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
                  }}
                >
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{ color: "common.white", maxWidth: 90 }}
                  >
                    {activeVersion?.label || "Version"}
                  </Typography>
                  <ArrowDropDownIcon
                    sx={{ fontSize: 16, color: "common.white" }}
                  />
                </Box>
              </Tooltip>
            )}
            {hideAnnotationsBadge ? null : isViewer2d ? (
              // 2D: plain count display — the annotations toggles are 3D-only.
              <Box
                sx={{
                  minWidth: 24,
                  px: 0.75,
                  py: 0.125,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid",
                  borderColor: isBlackChip
                    ? "rgba(255,255,255,0.5)"
                    : "divider",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: isBlackChip ? "common.white" : "text.secondary",
                  }}
                >
                  {annotationsCount}
                </Typography>
              </Box>
            ) : (
              <Tooltip
                title={
                  annotationsOn
                    ? "Masquer les annotations dans la vue 3D"
                    : "Afficher les annotations dans la vue 3D"
                }
                disableInteractive
              >
                <Box
                  onClick={(e) =>
                    handleToggleAnnotations(e, map, isMain, annotationsOn)
                  }
                  sx={{
                    minWidth: 24,
                    px: 0.75,
                    py: 0.125,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: annotationsOn ? "secondary.main" : "transparent",
                    border: "1px solid",
                    borderColor: annotationsOn ? "transparent" : "divider",
                    cursor: "pointer",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: annotationsOn
                        ? "secondary.contrastText"
                        : "text.disabled",
                    }}
                  >
                    {annotationsCount}
                  </Typography>
                </Box>
              </Tooltip>
            )}
          </Stack>
        );
      })}
      {annotationLessBaseMaps.length > 0 && (
        <>
          <Tooltip
            title="Fonds de plan sans annotation — épingler pour les afficher"
            disableInteractive
          >
            <Box
              onClick={(e) => setMoreMenuAnchorEl(e.currentTarget)}
              sx={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 1.25,
                py: 0.5,
                borderRadius: "16px",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                boxShadow: 2,
                cursor: "pointer",
                color: "text.secondary",
              }}
            >
              <MoreHorizIcon sx={{ fontSize: 18 }} />
            </Box>
          </Tooltip>
          <Menu
            anchorEl={moreMenuAnchorEl}
            open={Boolean(moreMenuAnchorEl)}
            onClose={() => setMoreMenuAnchorEl(null)}
          >
            {annotationLessBaseMaps.map((map) => {
              const pinned = pinnedIds.includes(map.id);
              return (
                <MenuItem
                  key={map.id}
                  dense
                  onClick={() =>
                    dispatch(togglePinnedBaseMapIdInViewer(map.id))
                  }
                >
                  <ListItemIcon>
                    {pinned ? (
                      <PushPinIcon fontSize="small" color="primary" />
                    ) : (
                      <PushPinOutlinedIcon fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={map.name}
                    primaryTypographyProps={{
                      variant: "body2",
                      noWrap: true,
                      sx: { maxWidth: 240 },
                    }}
                  />
                </MenuItem>
              );
            })}
          </Menu>
        </>
      )}
      {/* Version picker of the selected (black) chip — Viewer 2D only. */}
      {isViewer2d && (
        <Popover
          open={Boolean(versionsAnchorEl)}
          anchorEl={versionsAnchorEl}
          onClose={() => setVersionsAnchorEl(null)}
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
              Versions
            </Typography>
          </Box>
          <List dense sx={{ maxHeight: 300, overflowY: "auto", py: 0 }}>
            {sortedMainVersions.map((version) => {
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
      )}
    </Stack>
  );
}
