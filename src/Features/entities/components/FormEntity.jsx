import { Box } from "@mui/material";
import FormGeneric from "Features/form/components/FormGeneric";
import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function FormEntity({
  template,
  entity,
  onEntityChange,
  sectionContainerEl,
}) {
  // handlers

  function handleItemChange(item) {
    onEntityChange(item);
  }

  return (
    <Box sx={{ width: 1 }}>
      <FormGenericV2
        template={template}
        item={entity}
        onItemChange={handleItemChange}
        sectionContainerEl={sectionContainerEl}
      />
    </Box>
  );
}
