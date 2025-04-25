import {Box} from "@mui/material";
import DialogGeneric from "./DialogGeneric";
import FieldText from "Features/form/components/FieldText";

export default function DialogGenericRename({
  open,
  onClose,
  name,
  onNameChange,
}) {
  // strings

  const title = "Renommer";

  // handlers

  function handleChange(value) {
    onNameChange(value);
  }

  return (
    <DialogGeneric open={open} onClose={onClose} title={title}>
      <Box sx={{p: 2}}>
        <FieldText
          value={name}
          onChange={handleChange}
          options={{hideMic: true}}
        />
      </Box>
    </DialogGeneric>
  );
}
