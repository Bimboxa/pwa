import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setOnboardingIsActive } from "Features/onboarding/onboardingSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {
  Box,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Typography,
} from "@mui/material";
import { Upload } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";

import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import loadKrtoFile from "../services/loadKrtoFile";
import loadKrtoZip from "../services/loadKrtoZip";

export default function ButtonLoadKrtoFile() {
  const dispatch = useDispatch();

  // state

  const [open, setOpen] = useState(false);
  const [duplicate, setDuplicate] = useState(false);

  // data

  const appConfig = useAppConfig();

  // helpers

  //const extension = appConfig?.features?.krto?.extension;
  const extension = "zip";
  const krtoS = "." + extension ?? ".zip";
  const loadS = `Charger un fichier ${krtoS}`;

  // handlers

  async function handleLoadKrtoFile(files) {
    const file = files?.[0];
    if (file) {
      const { project, scope } = await loadKrtoZip(file, { duplicate });
      console.log("project", project, "scope", scope);
      if (project) {
        dispatch(setSelectedProjectId(project.id));
        if (scope) dispatch(setSelectedScopeId(scope.id));
        dispatch(setOnboardingIsActive(false));
      }
    }
    setDuplicate(false);
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
        <Box
          sx={{
            width: 300,
            height: 300,
            p: 2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <BoxCenter
            sx={{
              flex: 1,
              border: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <ContainerFilesSelector
              onFilesChange={handleLoadKrtoFile}
              callToActionLabel={loadS}
              accept=".krto"
            />
          </BoxCenter>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                size="small"
                checked={duplicate}
                onChange={(e) => setDuplicate(e.target.checked)}
              />
            }
            label={<Typography variant="body2">Dupliquer</Typography>}
          />
        </Box>
      </DialogGeneric>
    </>
  );
}
