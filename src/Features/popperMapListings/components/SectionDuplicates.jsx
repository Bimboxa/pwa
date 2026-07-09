import { useState } from "react";
import { useSelector } from "react-redux";

import { Box, Button, MenuItem, TextField, Typography } from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useLayers from "Features/layers/hooks/useLayers";
import useCreateLayer from "Features/layers/hooks/useCreateLayer";
import useUpdateAnnotations from "Features/annotations/hooks/useUpdateAnnotations";

import findDuplicateAnnotations from "Features/annotations/utils/findDuplicateAnnotations";

const NEW_LAYER = "__NEW__";

export default function SectionDuplicates() {
  // strings

  const crossLayersS = "Détecter entre les calques";
  const detectS = "Détecter";
  const noDuplicateS = "Aucun doublon détecté";
  const targetLayerS = "Calque cible";
  const newLayerS = "+ Nouveau calque « Doublons »";
  const moveS = "Déplacer les doublons";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const baseMap = useMainBaseMap();
  const annotations = useAnnotationsV2({
    caller: "SectionDuplicates",
    filterByMainBaseMap: true,
    hideBaseMapAnnotations: true,
    excludeBgAnnotations: true,
    excludeIsForBaseMapsListings: true,
    ignoreSolo: true,
  });
  const layers = useLayers({
    filterByBaseMapId: baseMap?.id,
    filterByScopeId: selectedScopeId,
  });
  const createLayer = useCreateLayer();
  const updateAnnotations = useUpdateAnnotations();

  // state

  const [crossLayers, setCrossLayers] = useState(false);
  const [result, setResult] = useState(null);
  const [targetLayerId, setTargetLayerId] = useState(NEW_LAYER);
  const [moving, setMoving] = useState(false);

  // helpers

  const duplicateIds = result?.duplicateIds ?? [];
  const count = duplicateIds.length;
  const countS = `${count} doublon${count > 1 ? "s" : ""} détecté${count > 1 ? "s" : ""}`;

  // handlers

  function handleCrossLayersChange(checked) {
    setCrossLayers(checked);
    setResult(null);
  }

  function handleDetect() {
    setResult(findDuplicateAnnotations(annotations ?? [], { crossLayers }));
  }

  async function handleMove() {
    if (count === 0 || !baseMap?.id) return;
    setMoving(true);
    try {
      let layerId = targetLayerId;
      if (layerId === NEW_LAYER) {
        const layer = await createLayer({
          baseMapId: baseMap.id,
          name: "Doublons",
        });
        layerId = layer.id;
      }
      await updateAnnotations(duplicateIds.map((id) => ({ id, layerId })));
      setResult(null);
    } finally {
      setMoving(false);
    }
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <FieldCheck
        value={crossLayers}
        onChange={handleCrossLayersChange}
        label={crossLayersS}
        options={{ type: "check", showAsInline: true }}
      />
      <Button
        fullWidth
        variant="outlined"
        onClick={handleDetect}
        disabled={!annotations?.length}
      >
        {detectS}
      </Button>

      {result && count === 0 && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {noDuplicateS}
        </Typography>
      )}

      {result && count > 0 && (
        <>
          <Typography variant="body2">{countS}</Typography>
          <TextField
            select
            size="small"
            fullWidth
            label={targetLayerS}
            value={targetLayerId}
            onChange={(e) => setTargetLayerId(e.target.value)}
          >
            <MenuItem value={NEW_LAYER}>{newLayerS}</MenuItem>
            {layers?.map((layer) => (
              <MenuItem key={layer.id} value={layer.id}>
                {layer.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            fullWidth
            variant="contained"
            onClick={handleMove}
            disabled={moving}
          >
            {moveS}
          </Button>
        </>
      )}
    </Box>
  );
}
