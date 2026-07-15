import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import useSelectedBaseMap from "Features/baseMaps/hooks/useSelectedBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import {
  setBaseMapOpacityIn3d,
  toggleBaseMapVisibleIn3d,
  setBaseMapAnnotationsModeIn3d,
  toggleMainBaseMapImageIn3d,
  toggleMainBaseMapAnnotationsIn3d,
} from "Features/threedEditor/threedEditorSlice";
import { ANNOTATIONS_DISPLAY_MODE_OPTIONS } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";

import SectionsBaseMapTransform3D, {
  SectionHeader,
} from "./SectionsBaseMapTransform3D";
import {
  IconAnnotationsHidden,
  IconAnnotationsNormal,
} from "./iconsAnnotationsDisplay";

import {
  Box,
  Card,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

export default function PanelBaseMapPosition3D() {
  const dispatch = useDispatch();

  const selected = useSelectedBaseMap();
  const main = useMainBaseMap();
  const baseMap = selected ?? main;
  const baseMapId = baseMap?.id ?? null;

  const { value: projectBaseMaps = [] } = useBaseMaps();
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

  const opacity = useSelector((s) => s.threedEditor.baseMapOpacityIn3d ?? 1);

  const lastVisibleOpacityRef = useRef(opacity > 0 ? opacity : 1);
  useEffect(() => {
    if (opacity > 0) lastVisibleOpacityRef.current = opacity;
  }, [opacity]);

  // ─── handlers ──────────────────────────────────────────────────────────

  function handleOpacityChange(_e, value) {
    if (value > 0) lastVisibleOpacityRef.current = value;
    dispatch(setBaseMapOpacityIn3d(value));
  }

  function toggleVisibility() {
    const next = opacity > 0 ? 0 : lastVisibleOpacityRef.current || 1;
    dispatch(setBaseMapOpacityIn3d(next));
  }

  if (!baseMap) return null;

  return (
    <Box>
      {/* Header: opacity slider + visibility toggle for the selected basemap. */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        useFlexGap
        sx={{ mb: 1.5 }}
      >
        <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Opacité
        </Typography>
        <Slider
          size="small"
          value={opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={handleOpacityChange}
          sx={{ width: 100, mr: 1 }}
        />
        <Tooltip title={opacity > 0 ? "Masquer" : "Afficher"}>
          <IconButton size="small" onClick={toggleVisibility}>
            {opacity > 0 ? (
              <Visibility fontSize="small" />
            ) : (
              <VisibilityOff fontSize="small" color="error" />
            )}
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={1.5}>
        {/* Base maps */}
        <Card variant="outlined" sx={{ p: 1.5 }}>
          <SectionHeader title="Fonds de plan" />
          <List dense disablePadding sx={{ maxHeight: 180, overflowY: "auto" }}>
            {projectBaseMaps.map((map) => {
              const isMain = map.id === baseMapId;
              const isVisible = isMain
                ? !hideMainImage
                : visibleIds.includes(map.id);
              const annotationsMode =
                annotationsModeByBaseMapId?.[map.id] ?? "NONE";
              return (
                <ListItem key={map.id} disablePadding>
                  <ListItemButton
                    selected={isMain}
                    onClick={() => dispatch(setSelectedMainBaseMapId(map.id))}
                    sx={{
                      py: 0.25,
                      borderRadius: 1,
                      gap: 0.5,
                    }}
                  >
                    <ListItemText
                      primary={map.name}
                      primaryTypographyProps={{
                        variant: "body2",
                        noWrap: true,
                        fontWeight: isMain ? 700 : 400,
                      }}
                    />
                    {/* Per-basemap annotation display mode. The main basemap
                        gets a simple on/off toggle (render-time flag, DIMMED
                        doesn't apply); the others get the 3-mode group. */}
                    {isMain ? (
                      <Tooltip
                        title={
                          hideMainAnnotations
                            ? "Afficher les annotations dans la vue 3D"
                            : "Masquer les annotations dans la vue 3D"
                        }
                      >
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch(toggleMainBaseMapAnnotationsIn3d());
                          }}
                        >
                          {hideMainAnnotations ? (
                            <IconAnnotationsHidden
                              sx={{ fontSize: 16 }}
                              color="error"
                            />
                          ) : (
                            <IconAnnotationsNormal sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={annotationsMode}
                        onChange={(e, v) => {
                          e.stopPropagation();
                          if (v) {
                            dispatch(
                              setBaseMapAnnotationsModeIn3d({
                                baseMapId: map.id,
                                mode: v,
                              })
                            );
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {ANNOTATIONS_DISPLAY_MODE_OPTIONS.map(
                          ({ mode, tooltip, Icon }) => (
                            <Tooltip key={mode} title={tooltip}>
                              <ToggleButton
                                value={mode}
                                sx={{ p: 0.4, border: "none" }}
                              >
                                <Icon sx={{ fontSize: 16 }} />
                              </ToggleButton>
                            </Tooltip>
                          )
                        )}
                      </ToggleButtonGroup>
                    )}
                    <Tooltip
                      title={
                        isVisible
                          ? "Masquer l'image dans la vue 3D"
                          : "Afficher l'image dans la vue 3D"
                      }
                    >
                      <IconButton
                        size="small"
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isMain) {
                            dispatch(toggleMainBaseMapImageIn3d());
                          } else {
                            dispatch(toggleBaseMapVisibleIn3d(map.id));
                          }
                        }}
                      >
                        {isVisible ? (
                          <Visibility fontSize="small" />
                        ) : (
                          <VisibilityOff fontSize="small" color="error" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Card>

        {/* Rotation / Translation / Offset */}
        <SectionsBaseMapTransform3D baseMap={baseMap} />
      </Stack>
    </Box>
  );
}
