import {Box} from "@mui/material";
import FormGeneric from "Features/form/components/FormGeneric";

export default function FormEntity({
  template,
  entity,
  lastEntity,
  onEntityChange,
  selectorContainerRef,
}) {
  // handlers

  function handleItemChange(item) {
    onEntityChange(item);
  }

  return (
    <Box sx={{width: 1, bgcolor: "common.white"}}>
      <FormGeneric
        template={template}
        item={entity}
        lastItem={lastEntity}
        onItemChange={handleItemChange}
        selectorContainerRef={selectorContainerRef}
      />
    </Box>
  );
}
