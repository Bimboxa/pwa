import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setNewEntity } from "../entitiesSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import useEntityFormTemplate from "../hooks/useEntityFormTemplate";
import useNewEntity from "../hooks/useNewEntity";

import useCreateEntity from "../hooks/useCreateEntity";

import { Box } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import Panel from "Features/layout/components/Panel";
import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function PanelCreateListingEntity({
  listing,
  onClose,
  onEntityCreated,
}) {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer";
  let title = "Créer une entité";

  // state

  const [tempItem, setTempItem] = useState({});

  // data

  const template = useEntityFormTemplate({ listing });
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const newEntity = useNewEntity();

  // data - func

  const createEntity = useCreateEntity();

  // helpers - item

  const item = { ...newEntity, ...tempItem };

  // helpers

  title = listing?.name ?? title;
  console.log("listingA", listing);

  // handlers

  function handleItemChange(item) {
    setTempItem(item);
    console.log("Item changed:", item);
    // Logic to handle item change can be added here
  }

  async function handleCreateClick() {
    console.log("Create listing entity - annotation", newAnnotation);
    // Logic to create a new listing entity goes here
    const entity = await createEntity(tempItem, {
      listing,
      annotation: newAnnotation,
    });

    dispatch(setNewEntity(null));
    dispatch(setNewAnnotation(null));

    // Close the panel after creation
    if (onEntityCreated) onEntityCreated(entity);
  }

  function handleClose() {
    dispatch(setNewEntity(null));
    dispatch(setNewAnnotation(null));
    onClose();
  }

  return (
    <Panel>
      <HeaderTitleClose title={title} onClose={handleClose} />
      <BoxFlexVStretch>
        <Box sx={{ bgcolor: "white" }}>
          <FormGenericV2
            template={template}
            item={item}
            onItemChange={handleItemChange}
          />
        </Box>
      </BoxFlexVStretch>
      <ButtonInPanel label={createS} onClick={handleCreateClick} />
    </Panel>
  );
}
