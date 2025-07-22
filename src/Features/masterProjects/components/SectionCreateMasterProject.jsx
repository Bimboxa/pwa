import { useState } from "react";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";

import { Box, Paper, TextField, Button, Typography } from "@mui/material";
import { ArrowDropDown as Down, ArrowDropUp as Up } from "@mui/icons-material";
import theme from "Styles/theme";

import IconButtonDropDown from "Features/layout/components/IconButtonDropDown";
import takeGmapScreenshot from "Features/gmap/services/takeGmapScreenshot";
import useCreateOnboardingData from "Features/onboarding/hooks/useCreateOnboardingData";
import { setOpenPanelCreateData } from "Features/onboarding/onboardingSlice";

export default function SectionCreateMasterProject({ gmap, gmapContainer }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // strings

  const newS = "Nouveau chantier";
  const createS = "Créer";
  const onboardingS = "Pas à pas";

  // state

  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");

  const [screenshot, setScreenshot] = useState(null);

  // data

  const createOnboardingData = useCreateOnboardingData();

  // handlers

  async function handleCreate() {
    const screenshot = await takeGmapScreenshot({ gmap, gmapContainer });

    // onboardingData

    const { project, map, issuesListing } = await createOnboardingData({
      projectName: name,
      mapFile: screenshot.file,
      mapMeterByPx: screenshot.meterByPx,
    });

    // dispatch
    dispatch(setSelectedProjectId(project?.id));
    dispatch(setSelectedMainBaseMapId(map.id));

    // navigate
    navigate("/");
  }

  function goToOnboarding() {
    dispatch(setOpenPanelCreateData(true));
    navigate("/onboarding");
  }

  return (
    <Box sx={{ width: 1 }}>
      <Box sx={{ p: 1 }}>
        <Button
          onClick={() => setOpen(!open)}
          endIcon={open ? <Up /> : <Down />}
        >
          <Typography variant="body2">{newS}</Typography>
        </Button>
      </Box>

      <Box
        sx={{ display: open ? "flex" : "none", flexDirection: "column", p: 1 }}
      >
        <TextField
          color="secondary"
          fullWidth
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Box
          sx={{
            mt: 1,
            width: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Button onClick={goToOnboarding} size="small">
            <Typography variant="body2" color="text.secondary">
              {onboardingS}
            </Typography>
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            color="secondary"
            size="small"
          >
            <Typography>{createS}</Typography>
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
