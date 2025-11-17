import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setOnboardingIsActive } from "Features/onboarding/onboardingSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Tooltip } from "@mui/material";
import { Upload } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";

import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import loadKrtoFile from "../services/loadKrtoFile";

export default function ButtonLoadKrtoFile() {
  const dispatch = useDispatch();

  // state

  const [open, setOpen] = useState(false);

  // data

  const appConfig = useAppConfig();

  // helpers

  const extension = appConfig?.features?.krto?.extension;
  const krtoS = "." + extension ?? ".krto";
  const loadS = `Charger un fichier ${krtoS}`;

  // handlers

  async function handleLoadKrtoFile(files) {
    const file = files?.[0];
    if (file) {
      const project = await loadKrtoFile(file);
      console.log("project", project);
      if (project) {
        dispatch(setSelectedProjectId(project.id));
        dispatch(setOnboardingIsActive(false));
      }
    }
    setOpen(false);
  }
  return (
    <>
      <Tooltip title={loadS}>
        <ButtonGeneric
          startIcon={<Upload />}
          label={krtoS}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <DialogGeneric open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 300, height: 300, p: 2 }}>
          <BoxCenter
            sx={{ border: (theme) => `1px solid ${theme.palette.divider}` }}
          >
            <ContainerFilesSelector
              onFilesChange={handleLoadKrtoFile}
              callToActionLabel={loadS}
              accept=".krto"
            />
          </BoxCenter>
        </Box>
      </DialogGeneric>
    </>
  );
}
