import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setActiveLayerId } from "../layersSlice";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Box, Typography, IconButton, List, Tooltip } from "@mui/material";
import LayersIcon from "@mui/icons-material/Layers";
import Add from "@mui/icons-material/Add";

import db from "App/db/db";
import useLayers from "../hooks/useLayers";
import useCreateLayer from "../hooks/useCreateLayer";
import useDndSensors from "App/hooks/useDndSensors";
import useMoveLayer from "../hooks/useMoveLayer";
import LayerRow from "./LayerRow";
import DialogCreateLayer from "./DialogCreateLayer";

export default function SectionLayers({ baseMapId }) {
  const dispatch = useDispatch();
  const createLayer = useCreateLayer();
  const moveLayer = useMoveLayer();

  // data

  const layers = useLayers({ filterByBaseMapId: baseMapId });
  const activeLayerId = useSelector((s) => s.layers.activeLayerId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  // annotation counts per layer
  const countByLayerId = useLiveQuery(
    async () => {
      if (!baseMapId) return {};
      const annotations = await db.annotations
        .where("baseMapId")
        .equals(baseMapId)
        .toArray();
      const counts = { __no_layer__: 0 };
      annotations
        .filter((a) => !a.deletedAt && !a.isBaseMapAnnotation)
        .forEach((a) => {
          if (a.layerId) {
            counts[a.layerId] = (counts[a.layerId] || 0) + 1;
          } else {
            counts.__no_layer__ += 1;
          }
        });
      return counts;
    },
    [baseMapId, annotationsUpdatedAt]
  );

  // DnD sensors

  const sensors = useDndSensors();

  // effects - clear active layer when switching baseMap

  useEffect(() => {
    if (activeLayerId && layers && !layers.find((l) => l.id === activeLayerId)) {
      dispatch(setActiveLayerId(null));
    }
  }, [layers, activeLayerId]);

  // helpers

  const sortableIds = useMemo(
    () => layers?.map((l) => l.id) ?? [],
    [layers]
  );

  // state

  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  // handlers

  const handleCreate = async (name) => {
    if (!baseMapId) return;
    await createLayer({ baseMapId, name });
    setOpenCreateDialog(false);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !layers?.length) return;

    const oldIndex = layers.findIndex((l) => l.id === active.id);
    const newIndex = layers.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    let prev, next;
    if (oldIndex < newIndex) {
      prev = layers[newIndex]?.orderIndex ?? null;
      next = newIndex + 1 < layers.length ? layers[newIndex + 1]?.orderIndex : null;
    } else {
      prev = newIndex > 0 ? layers[newIndex - 1]?.orderIndex : null;
      next = layers[newIndex]?.orderIndex ?? null;
    }

    moveLayer(active.id, prev, next);
  };

  // render

  if (!baseMapId) return null;

  return (
    <Box>
      {/* Section header */}
      <Box
        sx={{
          px: 1,
          py: 0.5,
          bgcolor: "panel.sectionBg",
          borderBottom: "1px solid",
          borderColor: "panel.border",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <LayersIcon sx={{ fontSize: 14, color: "panel.textMuted" }} />
          <Typography
            variant="caption"
            sx={{
              color: "panel.textMuted",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontSize: "11px",
            }}
          >
            Calques
          </Typography>
        </Box>
        <Tooltip title="Nouveau calque" arrow>
          <IconButton
            size="small"
            onClick={() => setOpenCreateDialog(true)}
            sx={{ p: 0.25, color: "panel.textMuted" }}
          >
            <Add sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Layers list */}
      <List dense disablePadding>
        {/* Sortable layers */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {layers?.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                count={countByLayerId?.[layer.id] ?? 0}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* "Sans calque" row — below layers */}
        <LayerRow
          isNoLayerRow
          count={countByLayerId?.__no_layer__ ?? 0}
        />
      </List>

      {openCreateDialog && (
        <DialogCreateLayer
          open={openCreateDialog}
          onClose={() => setOpenCreateDialog(false)}
          onConfirm={handleCreate}
        />
      )}
    </Box>
  );
}
