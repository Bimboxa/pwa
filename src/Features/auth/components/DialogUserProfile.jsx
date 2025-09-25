import { useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setUserProfile } from "../authSlice";

import { Box, Typography, TextField } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function DialogUserProfile({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const standaloneS = "Auteur des plans";

  const descriptionS = "Modifiez le nom utilisé comme auteur des plans.";

  const placeholder = "ex: Paul MAGNES";

  const saveS = "Modifier";

  // data

  const userProfile = useSelector((s) => s.auth.userProfile);

  // state

  const [name, setName] = useState("");

  useEffect(() => {
    if (userProfile?.userName) setName(userProfile.userName);
  }, [userProfile?.userName]);

  // handler

  function handleSave() {
    dispatch(setUserProfile({ userName: name }));
    onClose();
  }

  return (
    <DialogGeneric open={open} onClose={onClose} width={300}>
      <Box sx={{ p: 2 }}>
        <Box sx={{ bgcolor: "background.default", p: 1, borderRadius: "4px" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {standaloneS}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
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
          <Box
            sx={{
              p: 1,
              mt: 1,
              display: "flex",
              justifyContent: "end",
              width: 1,
            }}
          >
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
