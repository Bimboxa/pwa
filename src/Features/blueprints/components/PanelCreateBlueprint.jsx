import { useState, useEffect } from "react";

import { useDispatch } from "react-redux";

import { setSelectedEntityId } from "Features/entities/entitiesSlice";
import { setIsEditingEntity } from "Features/entities/entitiesSlice";
import { setEditedEntity } from "Features/entities/entitiesSlice";

import { setOpenedPanel } from "Features/listings/listingsSlice";

import { setBlueprintIdInMapEditor } from "../blueprintsSlice";

import useBlueprintPropsFromBgImageProps from "../hooks/useBlueprintPropsFromBgImageProps";
import useSaveEntity from "Features/entities/hooks/useSaveEntity";

import { Typography, Box } from "@mui/material";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionFormatBgImage from "Features/bgImage/components/SectionFormatBgImage";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import IconButtonClose from "Features/layout/components/IconButtonClose";

export default function PanelCreateBlueprint() {
  const dispatch = useDispatch();

  // strings

  const title = "Nouvel export";
  const nameLabel = "Nom de l'export";
  const createS = "Créer";

  // data

  const blueprintProps = useBlueprintPropsFromBgImageProps();
  const [saveEntity] = useSaveEntity();

  // state

  const [name, setName] = useState("");

  // handlers

  async function handleCreate() {
    const newEntity = { ...blueprintProps, name };
    const result = await saveEntity(newEntity, { updateSyncFile: true });
    dispatch(setSelectedEntityId(result.id));
    dispatch(setIsEditingEntity(false));
    dispatch(setEditedEntity(null));

    dispatch(setBlueprintIdInMapEditor(result.id));
    dispatch(setOpenedPanel("LISTING"));
  }

  function handleClose() {
    dispatch(setOpenedPanel("LISTING"));
  }
  return (
    <BoxFlexVStretch sx={{ bgcolor: "white" }}>
      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <FieldTextV2
              value={name}
              onChange={setName}
              label={nameLabel}
              options={{ fullWidth: true, showLabel: true }}
            />
          </Box>
          <IconButtonClose onClose={handleClose} />
        </Box>
        <SectionFormatBgImage />
      </BoxFlexVStretch>

      <ButtonInPanelV2
        label={createS}
        onClick={handleCreate}
        variant="contained"
        color="secondary"
        disabled={!name}
      />
    </BoxFlexVStretch>
  );
}
