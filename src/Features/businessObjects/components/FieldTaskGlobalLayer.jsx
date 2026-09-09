import { useSelector } from "react-redux";

import { MenuItem, TextField } from "@mui/material";

import useGlobalLayers from "Features/layers/hooks/useGlobalLayers";
import { selectLayersMode } from "Features/scopeConfig/utils/scopeConfigSelectors";

// Global layer of a PLANNING task: the annotation partition the task counts
// inside a work package ("" = every annotation of the package). Lists the
// scope's global layers; hints at the configuration when the scope still
// uses per-base-map layers.
export default function FieldTaskGlobalLayer({
  value,
  onChange,
  size = "small",
}) {
  const layers = useGlobalLayers();
  const layersMode = useSelector(selectLayersMode);

  const known = layers.some((l) => l.id === value);
  const helperText =
    layersMode !== "GLOBAL"
      ? "Calques globaux désactivés pour ce scope (Configuration › Dessin › Calques globaux)."
      : layers.length === 0
        ? "Aucun calque global : créez-en depuis le panneau Calques."
        : "Le poste ne compte que les annotations de ce calque dans une tâche.";

  return (
    <TextField
      select
      fullWidth
      size={size}
      label="Calque (découpage)"
      value={known ? value : ""}
      onChange={(e) => onChange(e.target.value || null)}
      helperText={helperText}
    >
      <MenuItem value="">Toutes les annotations (pas de calque)</MenuItem>
      {layers.map((l) => (
        <MenuItem key={l.id} value={l.id}>
          {l.name}
        </MenuItem>
      ))}
      {!known && value && (
        <MenuItem value={value} disabled>
          Calque introuvable
        </MenuItem>
      )}
    </TextField>
  );
}
