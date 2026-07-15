import { useDispatch, useSelector } from "react-redux";

import {
  toggleBaseMapVisibleIn3d,
  setBaseMapAnnotationsModeIn3d,
  toggleMainBaseMapImageIn3d,
  toggleMainBaseMapAnnotationsIn3d,
} from "Features/threedEditor/threedEditorSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { Box, Stack, Tooltip, Typography } from "@mui/material";
import LayersIcon from "@mui/icons-material/Layers";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsCountByBaseMapId from "Features/annotations/hooks/useAnnotationsCountByBaseMapId";
import { ANNOTATIONS_DISPLAY_MODE } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";

// Floating chips row pinned to the top-center of the 3D viewer — one chip per
// project basemap: a layer icon (image visibility state, click toggles the
// IMAGE in 3D), the basemap name, and a rounded badge with the annotations
// count (click toggles the ANNOTATIONS in 3D). Clicking the chip itself,
// outside those two buttons, selects the basemap as the main one (top-bar
// BaseMapSelector) — same as clicking its image in the 3D scene
// (MainThreedEditor.handleClick). The scene sync is already handled by
// useApplyBaseMapVisibilityIn3d / ThreedAnnotationsVisibility.
export default function TopBaseMapChipsThreed() {
  const dispatch = useDispatch();

  // data

  const { value: baseMaps = [] } = useBaseMaps();
  const mainBaseMap = useMainBaseMap();
  const annotationsCountByBaseMapId = useAnnotationsCountByBaseMapId();
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

  // handlers

  function handleSelect(map, isMain) {
    if (!isMain) dispatch(setSelectedMainBaseMapId(map.id));
  }

  function handleToggleImage(e, map, isMain) {
    e.stopPropagation();
    if (isMain) {
      dispatch(toggleMainBaseMapImageIn3d());
    } else {
      dispatch(toggleBaseMapVisibleIn3d(map.id));
    }
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
      sx={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "80%",
        overflowX: "auto",
        zIndex: 10,
        p: 0.5,
      }}
    >
      {baseMaps.map((map) => {
        const isMain = map.id === mainBaseMap?.id;
        const imageOn = isMain ? !hideMainImage : visibleIds.includes(map.id);
        const annotationsMode =
          annotationsModeByBaseMapId?.[map.id] ?? ANNOTATIONS_DISPLAY_MODE.NONE;
        const annotationsOn = isMain
          ? !hideMainAnnotations
          : annotationsMode !== ANNOTATIONS_DISPLAY_MODE.NONE;
        const annotationsCount = annotationsCountByBaseMapId[map.id] ?? 0;
        return (
          <Stack
            key={map.id}
            direction="row"
            alignItems="center"
            spacing={0.75}
            onClick={() => handleSelect(map, isMain)}
            sx={{
              flexShrink: 0,
              px: 1.25,
              py: 0.5,
              borderRadius: "16px",
              border: "1px solid",
              borderColor: isMain ? "primary.main" : "divider",
              bgcolor: "background.paper",
              boxShadow: 2,
              cursor: "pointer",
            }}
          >
            {/* Layer icon = image visibility state: white-on-grey when the
                image shows, grey-on-white when hidden. Tooltips are kept on
                disjoint zones (icon / name / badge) so they never stack. */}
            <Tooltip
              title={
                imageOn
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
                  bgcolor: imageOn ? "grey.500" : "common.white",
                  color: imageOn ? "common.white" : "grey.500",
                  border: "1px solid",
                  borderColor: imageOn ? "transparent" : "divider",
                  cursor: "pointer",
                }}
              >
                <LayersIcon sx={{ fontSize: 14 }} />
              </Box>
            </Tooltip>
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
                  color: isMain ? "primary.main" : "text.primary",
                }}
              >
                {map.name}
              </Typography>
            </Tooltip>
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
                  bgcolor: annotationsOn ? "action.selected" : "transparent",
                  border: "1px solid",
                  borderColor: annotationsOn ? "transparent" : "divider",
                  cursor: "pointer",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: annotationsOn ? "text.primary" : "text.disabled",
                  }}
                >
                  {annotationsCount}
                </Typography>
              </Box>
            </Tooltip>
          </Stack>
        );
      })}
    </Stack>
  );
}
