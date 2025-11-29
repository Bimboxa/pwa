import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setAnchorPositionLatLng } from "../mapEditorSlice";

import useMainBaseMap from "../hooks/useMainBaseMap";

import { Paper, TextField, Button, Typography } from "@mui/material";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMapListing from "Features/baseMaps/hooks/useMainBaseMapListing";

export default function SectionEditLatLng() {
  const dispatch = useDispatch();

  // string

  const label = "Lat / Lng (Google Maps)";
  const saveS = "Enregistrer";

  // state

  const [tempLatLng, setTempLatLng] = useState();

  // data

  const mainBaseMap = useMainBaseMap();
  const mainBaseMapListing = useMainBaseMapListing();
  const updateEntity = useUpdateEntity();
  const anchorPosition = useSelector((s) => s.mapEditor.anchorPositionLatLng);

  // helper

  const [lat, lng] = (tempLatLng ?? "").trim().split(",");
  const disabled = !lat || !lng;

  // handlers

  function handleChange(e) {
    const nextLatLng = e.target.value;
    setTempLatLng(nextLatLng);
  }

  async function handleSave() {
    if (!lat || !lng) return;

    const updates = {
      latLng: {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        x: anchorPosition.x,
        y: anchorPosition.y,
      },
    };

    await updateEntity(mainBaseMap?.id, updates, {
      listing: mainBaseMapListing,
    });
    dispatch(setAnchorPositionLatLng(null));
  }

  return (
    <Paper sx={{ display: "flex", alignItems: "center", p: 2 }}>
      <TextField
        size="small"
        value={tempLatLng ?? ""}
        onChange={handleChange}
        //label={label}
        sx={{
          "& .MuiInputBase-input": {
            fontSize: (theme) => theme.typography.body2.fontSize,
          },
        }}
        placeholder="48.8566, 2.3522"
      />
      <Button
        disabled={disabled}
        onClick={handleSave}
        sx={{ ml: 2 }}
        variant="contained"
      >
        <Typography>{saveS}</Typography>
      </Button>
    </Paper>
  );
}
