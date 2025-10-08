import { useState } from "react";

import { useDispatch } from "react-redux";

import { setUserProfile } from "../authSlice";

import { Box, Typography, TextField } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function DialogSignin({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const standaloneS = "Mode autonome";

  const descriptionS = "Précisez le nom utilisé comme auteur des plans.";

  const placeholder = "Prénom Nom";

  const saveS = "Enregistrer";

  // state

  const [name, setName] = useState("");

  // handler

  function handleSave() {
    dispatch(setUserProfile({ userName: name }));
  }

  return (
    <DialogGeneric open={open} onClose={onClose} width={300}>
      <Box sx={{ p: 2 }}>
        <Box sx={{ bgcolor: "background.default", p: 1, borderRadius: "4px" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {standaloneS}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {descriptionS}
          </Typography>
          <TextField
            sx={{ mt: 1 }}
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            placeholder={placeholder}
          />
          <Box sx={{ p: 1, display: "flex", justifyContent: "end", width: 1 }}>
            <ButtonGeneric
              label={saveS}
              onClick={handleSave}
              variant="contained"
              disabled={!name.length > 0}
            />
          </Box>
        </Box>
      </Box>
    </DialogGeneric>
  );
}
