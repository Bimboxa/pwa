import { useState } from "react";

import { useDispatch } from "react-redux";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { setTempAnnotations } from "Features/annotations/annotationsSlice";
import { setSelectedEntityId } from "Features/entities/entitiesSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import { TextField } from "@mui/material";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import getImageFileAndTempAnnotationsFromJson from "../utils/getImageFileAndTempAnnotationsFromJson";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

export default function ButtonDialogCreateBaseMapFromJson() {
  const dispatch = useDispatch();

  // strings

  const createS = "Création avancée (JSON)";
  const labelS = "JSON du croquis";

  // state

  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");

  // data

  const { value: listing } = useSelectedListing();
  const createEntity = useCreateEntity();

  // handlers

  async function handleCreate() {
    //console.log("debug_0915 input", json);
    const object = JSON.parse(json);
    console.log("debug_0915 object", object);
    let { imageFile, tempAnnotations, meterByPx } =
      await getImageFileAndTempAnnotationsFromJson(object);
    console.log("debug_0915 imageFile", imageFile);

    const entity = {
      name: "Croquis",
      image: { file: imageFile },
      meterByPx,
    };
    const result = await createEntity(entity, { listing });

    dispatch(setSelectedEntityId(result.id));
    dispatch(setSelectedMainBaseMapId(result.id));

    // temp annotations
    tempAnnotations = tempAnnotations.map((annotation) => ({
      ...annotation,
      baseMapId: result.id,
    }));

    console.log("debug_0915 tempAnnotations", tempAnnotations);

    dispatch(setTempAnnotations(tempAnnotations));

    //

    dispatch(setOpenedPanel("LISTING"));
  }

  // return

  return (
    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, p: 1 }}>
      <Box display="flex" gap={2} alignItems="center">
        <Typography variant="body2" color="text.secondary">
          {labelS}
        </Typography>
        <Box
          sx={{
            minWidth: 0,
            overflow: "hidden",
            maxHeight: "100px",
            flexGrow: 1,
          }}
        >
          <FieldTextV2
            options={{ multiline: true, fullWidth: true, size: "small" }}
            value={json}
            onChange={setJson}
          />
        </Box>
      </Box>
      <BoxAlignToRight>
        <ButtonGeneric
          label="Créer"
          onClick={handleCreate}
          size="small"
          variant="outlined"
        />
      </BoxAlignToRight>
    </Box>
  );
}
