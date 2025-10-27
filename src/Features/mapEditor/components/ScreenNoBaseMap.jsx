import { useState } from "react";
import { useSelector } from "react-redux";

import useAnnotationsListings from "Features/annotations/hooks/useAnnotationsListings";

import { Box } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import SectionCreateBaseMapFullscreen from "Features/mapEditor/components/SectionCreateBaseMapFullscreen";

import createBaseMap from "../assets/createBaseMap.png";

export default function ScreenNoBaseMap() {
  const createS = "Ajoutez un fond de plan";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const annotationsListings = useAnnotationsListings();

  console.log("annotationsListings", annotationsListings);

  // state

  const [open, setOpen] = useState(true);

  // helpers

  //const disabled = !projectId || !scopeId || !annotationsListings?.length > 0;
  const disabled = !projectId;

  // handlers

  function handleCreate() {
    setOpen(true);
  }

  if (open)
    return (
      <BoxCenter>
        <SectionCreateBaseMapFullscreen onClose={() => setOpen(false)} />
      </BoxCenter>
    );

  if (!open)
    return (
      <BoxCenter sx={{ position: "relative", bgcolor: "#FCFBFC" }}>
        <img
          src={createBaseMap}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "100%",
            objectFit: "contain",
            ...(disabled && { filter: "grayscale(100%)" }),
          }}
        />
        <Box sx={{ position: "absolute", bottom: "25%", right: "25%" }}>
          <ButtonGeneric
            label={createS}
            onClick={handleCreate}
            variant="contained"
            color="secondary"
            disabled={disabled}
          />
        </Box>
      </BoxCenter>
    );
}
