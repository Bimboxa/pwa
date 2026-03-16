import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { selectSelectedItem, triggerSelectionBack } from "Features/selection/selectionSlice";

import { Box, Typography, IconButton } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import db from "App/db/db";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import IconButtonMoreActionsLayer from "./IconButtonMoreActionsLayer";
import useUpdateLayer from "../hooks/useUpdateLayer";

export default function PanelLayerProperties() {
  const dispatch = useDispatch();
  const updateLayer = useUpdateLayer();

  // data

  const selectedItem = useSelector(selectSelectedItem);
  const layersUpdatedAt = useSelector((s) => s.layers.layersUpdatedAt);

  const layer = useLiveQuery(
    async () => {
      if (!selectedItem?.id) return null;
      const record = await db.layers.get(selectedItem.id);
      return record?.deletedAt ? null : record;
    },
    [selectedItem?.id, layersUpdatedAt]
  );

  // helpers

  const label = layer?.name ?? "-?-";

  // handlers

  const handleNameChange = (name) => {
    if (name && name.trim() && layer) {
      updateLayer(layer.id, { name: name.trim() });
    }
  };

  // render

  if (!layer) return null;

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton onClick={() => dispatch(triggerSelectionBack())}>
            <Back />
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: "bold", ml: 1 }}>
            {label}
          </Typography>
        </Box>

        <IconButtonMoreActionsLayer layer={layer} />
      </Box>

      {/* Content */}
      <BoxFlexVStretch sx={{ overflowY: "auto", p: 1.5, gap: 1 }}>
        <WhiteSectionGeneric>
          <FieldTextV2
            label="Nom du calque"
            value={layer.name}
            onChange={handleNameChange}
            options={{ fullWidth: true, changeOnBlur: true }}
          />
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
