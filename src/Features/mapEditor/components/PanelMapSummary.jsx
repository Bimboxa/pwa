import { useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";
import {
  setSelectedItem,
  setSelectedItems,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Typography, IconButton, Button, Chip } from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  ChevronRight,
  PlaylistAddCheck,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldBaseMapOpacity from "Features/baseMaps/components/FieldBaseMapOpacity";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useMainBaseMapListing from "Features/baseMaps/hooks/useMainBaseMapListing";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useAnnotations from "Features/annotations/hooks/useAnnotations";
import useLayers from "Features/layers/hooks/useLayers";

export default function PanelMapSummary() {
  // data

  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const mainBaseMapListing = useMainBaseMapListing();
  const { value: selectedScope } = useSelectedScope();

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const annotations = useAnnotations({ filterByBaseMapId: baseMapId });
  const layers = useLayers({ filterByBaseMapId: baseMapId });

  // helpers

  const scopeName = selectedScope?.name ?? "-";
  const baseMapUrl = baseMap?.getUrl?.();

  const annotationsByLayer = useMemo(() => {
    if (!annotations) return {};
    const map = {};
    annotations.forEach((a) => {
      const key = a.layerId || "__NO_LAYER__";
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [annotations]);

  const totalAnnotations = annotations?.length ?? 0;

  // handlers

  function handleSelectBaseMap() {
    if (!baseMap) return;
    dispatch(
      setSelectedItem({
        id: baseMap.id,
        type: "BASE_MAP",
        listingId: mainBaseMapListing?.id,
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleSelectAnnotationsByLayerId(layerId) {
    if (!annotations) return;
    const filtered =
      layerId === "__ALL__"
        ? annotations
        : annotations.filter((a) =>
            layerId === "__NO_LAYER__" ? !a.layerId : a.layerId === layerId
          );

    const items = filtered.map((a) => ({
      id: a.id,
      nodeId: a.id,
      type: "NODE",
      nodeType: a.type,
      entityId: a.entityId,
      listingId: a.listingId,
      pointId: null,
      partId: null,
      partType: null,
    }));

    if (items.length > 0) {
      dispatch(setSelectedItems(items));
    }
  }

  // render

  return (
    <BoxFlexVStretch sx={{ height: "100%" }}>
      {/* Header */}
      <Box
        sx={{
          p: 0.5,
          pl: 2,
        }}
      >
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{
            fontStyle: "italic",
            fontSize: (theme) => theme.typography.caption.fontSize,
          }}
        >
          Module Dessin
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {scopeName}
        </Typography>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        {/* Card 1: BaseMap preview + opacity */}
        <WhiteSectionGeneric>
          <Typography
            variant="body2"
            sx={{ fontWeight: "bold", mb: 1 }}
          >
            Fond de plan
          </Typography>

          {baseMapUrl && (
            <Box
              sx={{
                width: 1,
                height: 140,
                backgroundImage: `url(${baseMapUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                borderRadius: 1,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                mb: 1,
              }}
            />
          )}

          {baseMap && <FieldBaseMapOpacity baseMap={baseMap} />}

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
            <Button
              size="small"
              endIcon={<ChevronRight />}
              onClick={handleSelectBaseMap}
            >
              Voir le détail
            </Button>
          </Box>
        </WhiteSectionGeneric>

        {/* Card 2: Annotations summary */}
        <WhiteSectionGeneric>
          <Typography
            variant="body2"
            sx={{ fontWeight: "bold", mb: 1 }}
          >
            Annotations
          </Typography>

          {/* Total row */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 0.75,
              px: 0.5,
              bgcolor: "action.hover",
              borderRadius: 1,
              mb: 0.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                Total
              </Typography>
              <Chip label={totalAnnotations} size="small" />
            </Box>
            <IconButton
              size="small"
              onClick={() => handleSelectAnnotationsByLayerId("__ALL__")}
              disabled={totalAnnotations === 0}
            >
              <PlaylistAddCheck fontSize="small" />
            </IconButton>
          </Box>

          {/* Per layer rows */}
          {layers?.map((layer) => {
            const count = annotationsByLayer[layer.id]?.length ?? 0;
            return (
              <Box
                key={layer.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  py: 0.5,
                  borderBottom: (theme) =>
                    `1px solid ${theme.palette.divider}`,
                }}
              >
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                    {layer.name || "Sans nom"}
                  </Typography>
                  <Chip label={count} size="small" />
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleSelectAnnotationsByLayerId(layer.id)}
                  disabled={count === 0}
                >
                  <PlaylistAddCheck fontSize="small" />
                </IconButton>
              </Box>
            );
          })}

          {/* No layer row */}
          {annotationsByLayer["__NO_LAYER__"]?.length > 0 && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                py: 0.5,
              }}
            >
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ maxWidth: 150, fontStyle: "italic" }}
                >
                  Sans calque
                </Typography>
                <Chip
                  label={annotationsByLayer["__NO_LAYER__"].length}
                  size="small"
                />
              </Box>
              <IconButton
                size="small"
                onClick={() =>
                  handleSelectAnnotationsByLayerId("__NO_LAYER__")
                }
              >
                <PlaylistAddCheck fontSize="small" />
              </IconButton>
            </Box>
          )}
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
