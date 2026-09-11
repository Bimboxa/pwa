import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { setSelectedItems } from "Features/selection/selectionSlice";

import { Box, Typography, IconButton, Chip, Tooltip } from "@mui/material";
import { PlaylistAddCheck, BugReport, TableChart } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import SectionBaseMapOverview from "Features/baseMaps/components/SectionBaseMapOverview";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldSortableListings from "Features/popperMapListings/components/FieldSortableListings";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";
import useCanEditRecord from "App/hooks/useCanEditRecord";
import { canEditRecord } from "App/db/ownership";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useLayers from "Features/layers/hooks/useLayers";
import { selectSelectedModuleKey } from "Features/viewers/utils/effectiveViewerKey";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import DatagridAnnotations from "Features/annotations/components/DatagridAnnotations";
import CardBaseMapShare from "Features/baseMapShare/components/CardBaseMapShare";
import IconButtonMoreActionsScope from "./IconButtonMoreActionsScope";

export default function PanelPropertiesScope() {
  // data

  const dispatch = useDispatch();
  const appConfig = useAppConfig();
  const updateScope = useUpdateScope();
  const { value: selectedScope } = useSelectedScope();

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // "Voir le détail" of the base map card comes back to the current module.
  const selectedModuleKey = useSelector(selectSelectedModuleKey);

  // Scope RECORD rights stay creator-only: pure ownership check — the shared
  // useCanEditRecord hook now includes the editors-trigram bypass, which is
  // meant for scope CONTENT only (name / isPublic / editorsTrigrams excluded).
  const { currentUserId } = useCanEditRecord();
  const isCreator = selectedScope
    ? canEditRecord(selectedScope, currentUserId)
    : false;

  // Single source: the deprecated useAnnotations hook dropped annotations
  // without an entityId (e.g. procedure-created ones), so the layer counts
  // desynced from the datagrid below (already fed by annotationsV2).
  const annotationsV2 = useAnnotationsV2({
    caller: "PanelPropertiesScope",
    filterByBaseMapId: baseMapId,
    withQties: true,
  });
  const annotations = annotationsV2;
  const layers = useLayers({ filterByBaseMapId: baseMapId, filterByScopeId: selectedScope?.id });

  const [openDatagrid, setOpenDatagrid] = useState(false);

  // helpers

  const scopeName = selectedScope?.name ?? "-";
  const scopeLabel = appConfig?.strings?.scope?.nameSingular ?? "Repérage";

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

  function handleNameChange(name) {
    if (name && name.trim() && selectedScope) {
      updateScope({ id: selectedScope.id, name: name.trim() });
    }
  }

  function handleCopyAnnotationsDebug() {
    const json = JSON.stringify(annotationsV2 ?? [], null, 2);
    navigator.clipboard.writeText(json);
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              fontStyle: "italic",
              fontSize: (theme) => theme.typography.caption.fontSize,
            }}
          >
            {scopeLabel}
          </Typography>
          <Typography noWrap variant="body2" sx={{ fontWeight: "bold" }}>
            {scopeName}
          </Typography>
        </Box>
        {selectedScope && <IconButtonMoreActionsScope scope={selectedScope} />}
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        {/* Scope name — editable by the creator only (the db guard on the
            scopes table would reject anyone else anyway) */}
        {selectedScope && isCreator && (
          <FieldTextV2
            label="Nom"
            value={selectedScope.name}
            onChange={handleNameChange}
            options={{ showAsField: true, fullWidth: true, changeOnBlur: true }}
          />
        )}
        {selectedScope && !isCreator && (
          <WhiteSectionGeneric>
            <Typography variant="caption" color="text.secondary">
              Nom
            </Typography>
            <Typography variant="body2">{selectedScope.name}</Typography>
          </WhiteSectionGeneric>
        )}

        {/* Card 1: BaseMap preview + opacity */}
        <SectionBaseMapOverview returnFromViewer={selectedModuleKey} />

        {/* Card 2: Annotations summary */}
        <WhiteSectionGeneric>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Annotations
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Tooltip title="Copier les annotations (debug)">
                <IconButton
                  size="small"
                  onClick={handleCopyAnnotationsDebug}
                  sx={{ color: "divider" }}
                >
                  <BugReport fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Voir les données">
                <IconButton
                  size="small"
                  onClick={() => setOpenDatagrid(true)}
                >
                  <TableChart fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

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
                  Calque 0
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

        {/* Card 3: Sortable listings */}
        <FieldSortableListings />

        {/* Card 4: Partage */}
        <CardBaseMapShare />

      </BoxFlexVStretch>

      <DialogGeneric
        title={`${totalAnnotations} annotation(s)`}
        open={openDatagrid}
        onClose={() => setOpenDatagrid(false)}
        vw="90"
        vh="80"
      >
        <BoxFlexVStretch>
          <DatagridAnnotations annotations={annotationsV2 ?? []} onClose={() => setOpenDatagrid(false)} />
        </BoxFlexVStretch>
      </DialogGeneric>
    </BoxFlexVStretch>
  );
}
