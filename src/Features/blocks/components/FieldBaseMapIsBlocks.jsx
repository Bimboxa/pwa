import { useDispatch } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, Switch, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

import setBaseMapIsBlocksService, {
  BLOCKS_BASE_MAP_REFUSAL,
} from "../services/setBaseMapIsBlocksService";

// Switch of the base map properties panel: this base map is where the
// annotations of one or several blocks are drawn (`isBlocksBaseMap`). It is
// then listed under « Blocs » instead of its folder, and its annotations
// only count through the instances of their block.
export default function FieldBaseMapIsBlocks({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Définit des blocs";
  const captionS =
    "Les annotations de ce fond de plan composent un ou plusieurs blocs : elles ne sont comptées qu'au travers des instances de leur bloc.";
  const refusalMessages = {
    [BLOCKS_BASE_MAP_REFUSAL.HOSTS_INSTANCES]:
      "Ce fond de plan contient des instances de bloc : il ne peut pas définir de blocs.",
    [BLOCKS_BASE_MAP_REFUSAL.HOLDS_BLOCKS]:
      "Ce fond de plan définit encore un bloc : déliez ou supprimez d'abord ses annotations de bloc.",
    [BLOCKS_BASE_MAP_REFUSAL.NO_FOLDER]:
      "Aucun dossier de fonds de plan pour accueillir ce fond de plan.",
  };

  // data

  const listings = useProjectBaseMapListings();

  // helpers

  const checked = Boolean(baseMap?.isBlocksBaseMap);

  // handlers

  async function handleChange(e) {
    if (!baseMap?.id) return;
    const result = await setBaseMapIsBlocksService({
      baseMapId: baseMap.id,
      isBlocksBaseMap: e.target.checked,
      fallbackListingId: listings?.[0]?.id ?? null,
    });
    if (!result.ok) {
      const message = refusalMessages[result.refusal];
      if (message) dispatch(setToaster({ message, severity: "warning" }));
      return;
    }
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  if (!baseMap || baseMap.isDetail || baseMap.isPhoto) return null;

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
