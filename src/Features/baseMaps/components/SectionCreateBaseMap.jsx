import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { useNavigate } from "react-router-dom";

import { setSelectedEntityId } from "Features/entities/entitiesSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import FormGenericV2 from "Features/form/components/FormGenericV2";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import ButtonDialogCreateBaseMapFromJson from "./ButtonDialogCreateBaseMapFromJson";

export default function SectionCreateBaseMap({ onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // strings

  const title = "Nouveau fond de plan.";
  const createS = "Créer";

  // data

  const { value: listing } = useSelectedListing();
  const appConfig = useAppConfig();

  // data - func

  const createEntity = useCreateEntity();

  // state

  const [item, setItem] = useState({});

  // helper - max size

  const maxSize =
    appConfig?.entityModelsObject?.baseMap?.fieldsObject?.image?.options
      ?.maxSize;

  //  helper - template

  const template = {
    fields: [
      {
        key: "name",
        type: "text",
        label: "Nom",
        options: {
          showLabel: true,
          fullWidth: true,
        },
      },
      {
        key: "image",
        type: "image",
        label: "Image",
        options: {
          maxSize,
        },
      },
    ],
  };

  // handler

  function handleItemChange(item) {
    setItem(item);
  }

  async function handleCreateClick() {
    const entity = {
      name: item.name,
      image: { file: item.image.file },
    };
    const result = await createEntity(entity, { listing });

    dispatch(setSelectedEntityId(result.id));
    dispatch(setSelectedMainBaseMapId(result.id));

    if (onClose) onClose();
  }

  function handleClose() {
    console.log("closing");

    if (onClose) onClose();
  }

  function handleOpenPageGmap() {
    const url = `${window.location.origin}/gmap`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={title} onClose={handleClose} />
      <BoxFlexVStretch>
        <Box sx={{ bgcolor: "white" }}>
          <FormGenericV2
            item={item}
            onItemChange={handleItemChange}
            template={template}
          />
        </Box>
        <Box>
          <ButtonInPanelV2
            label={createS}
            onClick={handleCreateClick}
            color="secondary"
            variant="contained"
          />
        </Box>
      </BoxFlexVStretch>
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Création avancée
        </Typography>
        <ButtonInPanelV2
          label="Ouvrir Google Maps"
          onClick={handleOpenPageGmap}
          size="small"
          variant="outlined"
        />
        <ButtonDialogCreateBaseMapFromJson />
      </Box>
    </BoxFlexVStretch>
  );
}
