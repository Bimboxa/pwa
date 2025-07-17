import { useState } from "react";

import { useDispatch } from "react-redux";

import {
  setIssuesListingName,
  setShowOverview,
  setStep,
} from "../onboardingSlice";

import { Box, Typography, TextField, Button } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";

import BlockEditableListingName from "Features/listings/components/BlockEditableListingName";

export default function SectionStepCreateListings() {
  const dispatch = useDispatch();

  // strings

  const label = "Nom du calque";

  const createS = "Enregister";

  const description = `Organisez dans des calques les objets que vous ajoutez aux fonds de plan.`;

  // state

  const [tempIssuesListingName, setTempIssuesListingName] = useState("");

  // handlers

  function handleNameChage(e) {
    setTempIssuesListingName(e.target.value);
  }

  function handleCreate() {
    dispatch(setIssuesListingName(tempIssuesListingName));
    dispatch(setShowOverview(true));
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
        <Typography sx={{ mb: 2 }} color="text.secondary" variant="body2">
          {description}
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <BlockEditableListingName
            label={label}
            name={tempIssuesListingName}
            onChange={handleNameChage}
          />
        </Box>
        <Box sx={{ display: "flex", justifyContent: "end", mt: 2 }}>
          <Button variant="contained" onClick={handleCreate}>
            <Typography>{createS}</Typography>
          </Button>
        </Box>
      </Box>
    </BoxCenter>
  );
}
