import {useState} from "react";

import useCreateZonesTree from "../hooks/useCreateZonesTree";

import {TextField, Typography, Button, Box} from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";

import {nanoid} from "@reduxjs/toolkit";

export default function SectionCreateFirstZone() {
  // strings

  const createS = "Créer";
  const description = "Créez une première zone";

  // data

  const createZonesTree = useCreateZonesTree();
  // state

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // handlers

  function handleChange(e) {
    setName(e.target.value);
  }

  async function handleSave() {
    setLoading(true);
    const zonesTree = [{id: nanoid(), label: name, children: []}];
    await createZonesTree(zonesTree, {updateSyncFile: true});
    setLoading(false);
  }

  return (
    <BoxCenter sx={{display: "flex", flexDirection: "column"}}>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      <TextField fullWidth value={name} onChange={handleChange} sx={{p: 2}} />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "end",
          width: 1,
          px: 2,
        }}
      >
        <Button loading={loading} onClick={handleSave} variant="contained">
          <Typography>{createS}</Typography>
        </Button>
      </Box>
    </BoxCenter>
  );
}
