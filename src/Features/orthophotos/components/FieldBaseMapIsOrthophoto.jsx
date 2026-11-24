import { useDispatch } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";

import { Box, Switch, Typography } from "@mui/material";

import db from "App/db/db";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

// Switch of the base map properties panel: this base map is an orthomosaic
// assembled from several top-down photos (`isOrthophoto`). It then gets the
// Orthophotos tool (Fonds de plan module) and the stations toggle of the
// bottom bar. Switching it off keeps the unit orthophotos in the db.
export default function FieldBaseMapIsOrthophoto({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Orthomosaïque";
  const captionS =
    "Ce fond de plan est assemblé à partir de photos vues de dessus : gérez ses orthophotos unitaires dans l'outil « Orthophotos » du module Fonds de plan.";

  // helpers

  const checked = Boolean(baseMap?.isOrthophoto);

  // handlers

  async function handleChange(e) {
    if (!baseMap?.id) return;
    await db.baseMaps.update(baseMap.id, { isOrthophoto: e.target.checked });
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerBaseMapsUpdate());
  }

  // render

  if (
    !baseMap ||
    baseMap.isDetail ||
    baseMap.isPhoto ||
    baseMap.isBlocksBaseMap
  ) {
    return null;
  }

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {labelS}
        </Typography>
        <Switch size="small" checked={checked} onChange={handleChange} />
      </Box>
      {checked && (
        <Typography variant="caption" color="text.secondary">
          {captionS}
        </Typography>
      )}
    </WhiteSectionGeneric>
  );
}
