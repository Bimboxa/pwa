import { useDispatch, useSelector } from "react-redux";

import {
  toggleBaseMapVisibleIn3d,
  setBaseMapAnnotationsModeIn3d,
  toggleMainBaseMapImageIn3d,
  toggleMainBaseMapAnnotationsIn3d,
} from "Features/threedEditor/threedEditorSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsCountByBaseMapId from "Features/annotations/hooks/useAnnotationsCountByBaseMapId";
import {
  IconAnnotationsHidden,
  IconAnnotationsNormal,
} from "Features/threedEditor/components/iconsAnnotationsDisplay";
import { ANNOTATIONS_DISPLAY_MODE } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";

// Floating chips row pinned to the top-center of the 3D viewer — one chip per
// project basemap. Each chip: click on the name selects it as the main
// basemap (the one shown in the top-bar selector); at rest it shows the
// basemap's annotations count, and hovering the chip swaps the count for the
// two visibility toggles (image eye / annotations polygon) without resizing —
// the icons own the layout, the count is absolutely centered on top.
// Horizontal re-presentation of the "Fonds de plan" list of
// PanelBaseMapPosition3D — same redux state and actions, the scene sync is
// already handled by useApplyBaseMapVisibilityIn3d / ThreedAnnotationsVisibility.
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

  function handleSelect(map) {
    if (map.id !== mainBaseMap?.id)
      dispatch(setSelectedMainBaseMapId(map.id));
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
        const imageOn = isMain
          ? !hideMainImage
          : visibleIds.includes(map.id);
        const annotationsMode =
          annotationsModeByBaseMapId?.[map.id] ??
          ANNOTATIONS_DISPLAY_MODE.NONE;
        const annotationsOn = isMain
          ? !hideMainAnnotations
          : annotationsMode !== ANNOTATIONS_DISPLAY_MODE.NONE;
        const annotationsCount = annotationsCountByBaseMapId[map.id] ?? 0;
        return (
          <Stack
            key={map.id}
            direction="row"
            alignItems="center"
            spacing={0.25}
            onClick={() => handleSelect(map)}
            sx={{
              flexShrink: 0,
              pl: 1.25,
              pr: 0.5,
              py: 0.25,
              borderRadius: "16px",
              border: "1px solid",
              borderColor: isMain ? "primary.main" : "divider",
              bgcolor: "background.paper",
              boxShadow: 2,
              cursor: "pointer",
              "&:hover": { bgcolor: "action.hover" },
              "&:hover .chipActions": { opacity: 1, pointerEvents: "auto" },
              "&:hover .chipCount": { opacity: 0 },
            }}
          >
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
            {/* Count / actions swap zone: the icon pair defines the width so
                the chip never resizes; the count is absolutely centered on
                top and fades out on chip hover. */}
            <Box sx={{ position: "relative", display: "flex" }}>
              <Stack
                className="chipActions"
                direction="row"
                alignItems="center"
                spacing={0.25}
                sx={{
                  opacity: 0,
                  pointerEvents: "none",
                  transition: "opacity 0.15s",
                }}
              >
                <Tooltip
                  title={
                    imageOn
                      ? "Masquer l'image dans la vue 3D"
                      : "Afficher l'image dans la vue 3D"
                  }
                  disableInteractive
                >
                  <IconButton
                    size="small"
                    onClick={(e) => handleToggleImage(e, map, isMain)}
                  >
                    {imageOn ? (
                      <Visibility sx={{ fontSize: 16 }} />
                    ) : (
                      <VisibilityOff sx={{ fontSize: 16 }} color="error" />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip
                  title={
                    annotationsOn
                      ? "Masquer les annotations dans la vue 3D"
                      : "Afficher les annotations dans la vue 3D"
                  }
                  disableInteractive
                >
                  <IconButton
                    size="small"
                    onClick={(e) =>
                      handleToggleAnnotations(e, map, isMain, annotationsOn)
                    }
                  >
                    {annotationsOn ? (
                      <IconAnnotationsNormal sx={{ fontSize: 16 }} />
                    ) : (
                      <IconAnnotationsHidden
                        sx={{ fontSize: 16 }}
                        color="error"
                      />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>
              <Typography
                className="chipCount"
                variant="caption"
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  color: "text.secondary",
                  fontWeight: 600,
                  transition: "opacity 0.15s",
                }}
              >
                {annotationsCount}
              </Typography>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
