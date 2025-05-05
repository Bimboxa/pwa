import {Box} from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import ListEntities from "./ListEntities";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";

export default function PanelSelectorEntity({
  title,
  entities,
  selectedEntityId,
  onSelectionChange,
  onClose,
}) {
  console.log("entities", entities);

  // helpers

  const selection = selectedEntityId ? [selectedEntityId] : [];

  // handlers

  function handleClick(entity) {
    const id = selectedEntityId === entity.id ? null : entity.id;
    onSelectionChange(id);
  }

  return (
    <BoxFlexVStretch>
      {title && <HeaderTitleClose title={title} onClose={onClose} />}
      <Box sx={{bgcolor: "white"}}>
        <ListEntities
          entities={entities}
          selection={selection}
          onClick={handleClick}
        />
      </Box>
    </BoxFlexVStretch>
  );
}
