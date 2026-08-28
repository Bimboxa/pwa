import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";

import db from "App/db/db";
import FieldCheck from "Features/form/components/FieldCheck";
import {
  buildReorderUpdates,
  getNextLayerIndexKey,
  sortLayerStrips,
} from "Features/annotations/utils/layerStackOrder";

// Material-layer flag ("Couche") of a STRIP. Layer strips drawn on the same
// support line are stacked at render time in layerIndex order; the arrows
// move the layer within the stack of its base map.
export default function FieldAnnotationIsLayer({ annotation }) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Couche";
  const orderS = "Ordre d'empilement";
  const moveUpS = "Monter dans l'empilement";
  const moveDownS = "Descendre dans l'empilement";

  // data

  const layers = useLiveQuery(async () => {
    if (!annotation?.baseMapId) return [];
    const rows = await db.annotations
      .where("baseMapId")
      .equals(annotation.baseMapId)
      .toArray();
    return sortLayerStrips(
      rows.filter((r) => !r.deletedAt && r.type === "STRIP" && r.isLayer)
    );
  }, [annotation?.baseMapId]);

  // helpers

  const position = layers?.findIndex((l) => l.id === annotation?.id) ?? -1;
  const canMoveDown = position > 0;
  const canMoveUp = position >= 0 && position < (layers?.length ?? 0) - 1;

  // handlers

  async function handleChange(checked) {
    if (!annotation?.id) return;
    const changes = { isLayer: checked };
    // First activation: place the layer on top of the base map's stack. The
    // key is kept on deactivation so re-enabling restores the slot.
    if (checked && !annotation.layerIndex && annotation.baseMapId) {
      changes.layerIndex = getNextLayerIndexKey(
        (layers ?? []).filter((l) => l.id !== annotation.id)
      );
    }
    await db.annotations.update(annotation.id, changes);
    dispatch(triggerAnnotationsUpdate());
  }

  async function handleMove(direction) {
    if (!annotation?.id || !layers?.length) return;
    const updates = buildReorderUpdates(layers, annotation.id, direction);
    if (!updates.length) return;
    await db.transaction("rw", db.annotations, async () => {
      for (const u of updates) {
        await db.annotations.update(u.id, { layerIndex: u.layerIndex });
      }
    });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <>
      <FieldCheck
        value={Boolean(annotation?.isLayer)}
        onChange={handleChange}
        label={labelS}
        options={{ type: "switch", showAsSection: true }}
      />
      {annotation?.isLayer && (
        <Box sx={{ display: "flex", alignItems: "center", px: 1, gap: 0.5 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ flexGrow: 1 }}
          >
            {orderS}
            {position >= 0 ? ` (${position + 1}/${layers.length})` : ""}
          </Typography>
          <Tooltip title={moveDownS}>
            <span>
              <IconButton
                size="small"
                disabled={!canMoveDown}
                onClick={() => handleMove("down")}
              >
                <ArrowDownward fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={moveUpS}>
            <span>
              <IconButton
                size="small"
                disabled={!canMoveUp}
                onClick={() => handleMove("up")}
              >
                <ArrowUpward fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}
    </>
  );
}
