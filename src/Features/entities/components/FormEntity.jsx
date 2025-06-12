import {Box} from "@mui/material";
import FormGeneric from "Features/form/components/FormGeneric";

export default function FormEntity({
  template,
  entity,
  onEntityChange,
  selectorContainerRef,
}) {
  // handlers

  function handleItemChange(item) {
    onEntityChange(item);
  }

  return (
    <Box sx={{width: 1}}>
      <FormGeneric
        template={template}
        item={entity}
        onItemChange={handleItemChange}
        selectorContainerRef={selectorContainerRef}
      />
    </Box>
  );
}
