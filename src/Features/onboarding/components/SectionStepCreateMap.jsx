import { useState } from "react";

import { useDispatch } from "react-redux";

import { setMapName, setMapFile, setStep } from "../onboardingSlice";

import { Box, Typography, TextField, Button } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import SelectorImage from "Features/images/components/SelectorImage";

import pdfToPngAsync from "Features/pdf/utils/pdfToPngAsync";

export default function SectionStepCreateMap() {
  const dispatch = useDispatch();

  // strings

  const label = "Nom du fond de plan";
  const addS = "Ajouter";

  const description = `Tous vos plans de repérage sont organisés par projet.`;

  // state

  const [tempFile, setTempFile] = useState(null);
  const [tempMapName, setTempMapName] = useState("");

  // handlers

  async function handleImageFileChange(file) {
    if (file) {
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      setTempFile(file);
      setTempMapName(fileName);
    } else {
      setTempFile(null);
      setTempMapName("");
    }
  }

  function handleNameChage(e) {
    setTempMapName(e.target.value);
  }

  function handleCreate() {
    dispatch(setMapName(tempMapName));
    dispatch(setMapFile(tempFile));
    dispatch(setStep("CREATE_LISTINGS"));
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
      <SelectorImage onImageFileChange={handleImageFileChange} />
      <Box sx={{ display: "flex", justifyContent: "end", width: 1, mt: 3 }}>
        <TextField
          label={label}
          value={tempMapName}
          onChange={handleNameChage}
          sx={{ mr: 1 }}
        />
        <Button variant="contained" onClick={handleCreate}>
          <Typography>{addS}</Typography>
        </Button>
      </Box>
    </BoxCenter>
  );
}
