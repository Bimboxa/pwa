import { Box } from "@mui/material";
import FormGeneric from "Features/form/components/FormGeneric";
import FormGenericV2 from "Features/form/components/FormGenericV2";
import FieldToggleFWC from "Features/fwc/components/FieldToggleFWC";

export default function FormEntity({
  template,
  entity,
  onEntityChange,
  sectionContainerEl,
}) {

  // helpers

  const showToggleFwC = entity?.entityModel?.fwcEnabled;

  // handlers

  function handleItemChange(item) {
    onEntityChange(item);
  }

  function handleFwcChange(fwc) {
    onEntityChange({ ...entity, fwc });
  }

  return (
    <Box sx={{ width: 1 }}>
      {showToggleFwC && <Box sx={{ width: 1, p: 2 }}><FieldToggleFWC value={entity.fwc} onChange={handleFwcChange} /></Box>}
      <FormGenericV2
        template={template}
        item={entity}
        onItemChange={handleItemChange}
        sectionContainerEl={sectionContainerEl}
      />
    </Box>
  );
}
