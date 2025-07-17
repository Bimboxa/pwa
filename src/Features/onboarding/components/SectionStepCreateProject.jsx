import { useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setProjectName, setStep } from "../onboardingSlice";

import { Box, Typography, TextField, Button } from "@mui/material";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function SectionStepCreateProject() {
  const dispatch = useDispatch();

  // strings

  const label = "Nom du projet";
  const createS = "Créer";

  const description = `Tous vos plans de repérage sont organisés par projet.`;

  // data

  const projectName = useSelector((s) => s.onboarding.projectName);

  // state

  const [tempName, setTempName] = useState("");
  useEffect(() => {
    setTempName(projectName);
  }, [projectName]);

  // handlers

  function handleChange(e) {
    setTempName(e.target.value);
  }

  function handleCreate() {
    dispatch(setProjectName(tempName));
    dispatch(setStep("CREATE_MAP"));
  }

  // render

  return (
    <BoxCenter
      sx={{
        p: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Box>
        <TextField
          fullWidth
          label={label}
          value={tempName}
          onChange={handleChange}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {description}
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "end", mt: 2 }}>
          <Button variant="contained" onClick={handleCreate}>
            <Typography>{createS}</Typography>
          </Button>
        </Box>
      </Box>
    </BoxCenter>
  );
}
