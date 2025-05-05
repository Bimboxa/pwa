import {Box} from "@mui/material";
import useDataObject from "../hooks/useDataObject";
import FormGeneric from "Features/form/components/FormGeneric";

export default function SectionDataObjectInListPanel() {
  console.log("[SectionDataObjectInListPanel]");
  // data

  const {formTemplate, dataObject} = useDataObject();

  // handlers

  function handleDataObjectChange(item) {
    console.log("handleDataObjectChange", item);
  }

  //
  return (
    <Box sx={{width: 1, bgcolor: "common.white"}}>
      <FormGeneric
        template={formTemplate}
        item={dataObject}
        onItemChange={handleDataObjectChange}
        //forceVariantGrid={true}
      />
    </Box>
  );
}
