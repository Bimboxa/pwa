import {useState} from "react";

import useUpdateScope from "../hooks/useUpdateScope";

import {Box, Button} from "@mui/material";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import FormScope from "./FormScope";

export default function DialogEditScope({open, onClose, scope}) {
  // strings

  const saveS = "Enregistrer";

  // state

  const [tempScope, setTempScope] = useState(null);
  const [loading, setLoading] = useState(false);

  // data

  const update = useUpdateScope();

  // handlers

  function handleChange(newScope) {
    setTempScope(newScope);
  }

  async function handleSave() {
    setLoading(true);
    await update(tempScope);
    setLoading(false);
    onClose();
  }

  return (
    <DialogGeneric open={open} onClose={onClose} title={scope?.name}>
      <FormScope scope={scope} onChange={handleChange} />
      <Box sx={{width: 1, display: "flex", justifyContent: "end", mt: 2, p: 1}}>
        <Button
          onClick={handleSave}
          loading={loading}
          variant="contained"
          disabled={!tempScope}
        >
          {saveS}
        </Button>
      </Box>
    </DialogGeneric>
  );
}
