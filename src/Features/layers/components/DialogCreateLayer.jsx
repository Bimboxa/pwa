import { useState, useMemo } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  DialogTitle,
  Box,
  TextField,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Chip,
} from "@mui/material";

import db from "App/db/db";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import useLayers from "../hooks/useLayers";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function DialogCreateLayer({ open, onClose, onConfirm, baseMapId }) {
  // strings

  const titleS = "Nouveau calque";
  const createS = "Créer";
  const duplicateTitleS = "Dupliquer des annotations";
  const noLayerS = "Sans calque";

  // data

  const layers = useLayers({ filterByBaseMapId: baseMapId });
  const appConfig = useAppConfig();
  const { value: scope } = useSelectedScope();
  const annotationTemplates = useAnnotationTemplates();
  const hiddenTemplateIds = useMemo(() => {
    if (!annotationTemplates) return new Set();
    return new Set(
      annotationTemplates.filter((t) => t.hidden).map((t) => t.id)
    );
  }, [annotationTemplates]);

  const hiddenLayerIds = useSelector((s) => s.layers?.hiddenLayerIds || []);
  const showAnnotationsWithoutLayer = useSelector(
    (s) => s.layers?.showAnnotationsWithoutLayer ?? true
  );
  const hiddenListingsIds = useSelector(
    (s) => s.listings?.hiddenListingsIds || []
  );
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  // visible annotations grouped by layer
  const visibleByLayer = useLiveQuery(
    async () => {
      if (!baseMapId) return {};
      const annotations = (
        await db.annotations.where("baseMapId").equals(baseMapId).toArray()
      ).filter((a) => !a.deletedAt && !a.isBaseMapAnnotation);

      // scope filter
      let filtered = annotations;
      if (scope?.id) {
        const listingIds = (
          await db.listings.where("projectId").equals(projectId).toArray()
        ).filter((l) => !l.deletedAt);
        const scopeListingIds = new Set(
          listingIds
            .filter((l) => {
              const em = appConfig?.entityModelsObject?.[l.entityModelKey];
              return em?.type === "BASE_MAP" || l.scopeId === scope?.id;
            })
            .map((l) => l.id)
        );
        filtered = filtered.filter((a) => scopeListingIds.has(a.listingId));
      }

      // hidden listings filter
      if (hiddenListingsIds.length > 0) {
        filtered = filtered.filter(
          (a) => !hiddenListingsIds.includes(a.listingId)
        );
      }

      // hidden template filter
      if (hiddenTemplateIds.size > 0) {
        filtered = filtered.filter(
          (a) =>
            !a.annotationTemplateId ||
            !hiddenTemplateIds.has(a.annotationTemplateId)
        );
      }

      // layer visibility filter
      if (hiddenLayerIds.length > 0 || !showAnnotationsWithoutLayer) {
        filtered = filtered.filter((a) => {
          if (!a.layerId) return showAnnotationsWithoutLayer;
          return !hiddenLayerIds.includes(a.layerId);
        });
      }

      // group by layerId
      const grouped = {};
      for (const a of filtered) {
        const key = a.layerId || "__no_layer__";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(a.id);
      }
      return grouped;
    },
    [
      baseMapId,
      scope?.id,
      projectId,
      hiddenListingsIds,
      hiddenTemplateIds,
      hiddenLayerIds,
      showAnnotationsWithoutLayer,
      annotationsUpdatedAt,
    ]
  );

  // state

  const [name, setName] = useState("");
  const [selectedLayerIds, setSelectedLayerIds] = useState([]);

  // helpers

  const selectableLayers = useMemo(() => {
    if (!layers || !visibleByLayer) return [];
    const items = [];
    for (const layer of layers) {
      const count = visibleByLayer[layer.id]?.length || 0;
      if (count > 0) items.push({ id: layer.id, name: layer.name, count });
    }
    const noLayerCount = visibleByLayer["__no_layer__"]?.length || 0;
    if (noLayerCount > 0) {
      items.push({ id: "__no_layer__", name: noLayerS, count: noLayerCount });
    }
    return items;
  }, [layers, visibleByLayer]);

  // handlers

  const handleToggleLayer = (layerId) => {
    setSelectedLayerIds((prev) =>
      prev.includes(layerId)
        ? prev.filter((id) => id !== layerId)
        : [...prev, layerId]
    );
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // collect annotation IDs to duplicate from selected layers
    const annotationIdsToDuplicate = [];
    for (const layerId of selectedLayerIds) {
      const ids = visibleByLayer?.[layerId] || [];
      annotationIdsToDuplicate.push(...ids);
    }
    onConfirm({
      name: trimmed,
      annotationIdsToDuplicate:
        annotationIdsToDuplicate.length > 0 ? annotationIdsToDuplicate : null,
    });
    setName("");
    setSelectedLayerIds([]);
  };

  const handleClose = () => {
    setName("");
    setSelectedLayerIds([]);
    onClose();
  };

  // render

  return (
    <DialogGeneric open={open} onClose={handleClose} width="320px">
      <DialogTitle>{titleS}</DialogTitle>
      <Box sx={{ px: 3, pb: 1 }}>
        <TextField
          autoFocus
          label="Nom du calque"
          size="small"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            e.stopPropagation();
          }}
        />
      </Box>
      <ButtonInPanelV2
        onClick={handleCreate}
        label={createS}
        variant="contained"
        disabled={!name.trim()}
      />

      {selectableLayers.length > 0 && (
        <Box sx={{ bgcolor: "background.default", px: 2, py: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontSize: "11px",
              color: "text.secondary",
              mb: 0.5,
              display: "block",
            }}
          >
            {duplicateTitleS}
          </Typography>
          <List dense disablePadding>
            {selectableLayers.map((item) => (
              <ListItemButton
                key={item.id}
                dense
                onClick={() => handleToggleLayer(item.id)}
                sx={{ px: 0.5, py: 0.25, borderRadius: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Checkbox
                    edge="start"
                    size="small"
                    checked={selectedLayerIds.includes(item.id)}
                    disableRipple
                    sx={{ p: 0.25 }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={item.name}
                  primaryTypographyProps={{
                    variant: "body2",
                    sx: {
                      fontStyle:
                        item.id === "__no_layer__" ? "italic" : "normal",
                    },
                  }}
                />
                <Chip label={item.count} size="small" sx={{ height: 20 }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}
    </DialogGeneric>
  );
}
