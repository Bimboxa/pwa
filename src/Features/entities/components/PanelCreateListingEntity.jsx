import {useState} from "react";

import {Box} from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import Panel from "Features/layout/components/Panel";
import FormGeneric from "Features/form/components/FormGeneric";

import useEntityFormTemplate from "../hooks/useEntityFormTemplate";
import useCreateEntity from "../hooks/useCreateEntity";
import {create} from "qrcode";

export default function PanelCreateListingEntity({
  listing,
  open,
  onClose,
  onEntityCreated,
}) {
  // strings

  const createS = "Créer";
  let title = "Créer une entité";

  // state

  const [tempItem, setTempItem] = useState({});

  // data

  const template = useEntityFormTemplate({listing});
  const createEntity = useCreateEntity();

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
    console.log("Create listing entity");
    // Logic to create a new listing entity goes here
    const entity = await createEntity(tempItem, {listing});

    // Close the panel after creation
    onEntityCreated(entity);
  }
  return (
    <Panel>
      <HeaderTitleClose title={title} onClose={onClose} />
      <BoxFlexVStretch>
        <Box sx={{bgcolor: "white"}}>
          <FormGeneric
            template={template}
            item={tempItem}
            onItemChange={handleItemChange}
          />
        </Box>
      </BoxFlexVStretch>
      <ButtonInPanel label={createS} onClick={handleCreateClick} />
    </Panel>
  );
}
