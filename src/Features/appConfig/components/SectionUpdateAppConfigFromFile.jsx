import {useState} from "react";

import useUpdateOrgaAppConfig from "../hooks/useUpdateOrgaAppConfig";

import {Box, Button, Typography} from "@mui/material";
import {ArrowDropDown as Down, ArrowDropUp as Up} from "@mui/icons-material";

import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import yamlToJsonAsync from "Features/files/utils/yamlToJsonAsync";
import SwitchUseDefault from "./SwitchUseDefault";

export default function SectionUpdateAppConfigFromFile() {
  // strings

  const updateS = "Modifier la configuration";

  const callToActionLabel = "Fichier de configuration .yaml";

  // data

  const updateOrgaAppConfig = useUpdateOrgaAppConfig();

  // state

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // handlers

  async function handleFilesChange(files) {
    console.log("files", files);
    const file = files?.[0];
    if (file) {
      setLoading(true);
      const appConfig = await yamlToJsonAsync(file);
      console.log("appConfig", appConfig);
      await updateOrgaAppConfig(appConfig);
      setLoading(false);
    }
  }
  return (
    <Box sx={{width: 1}}>
      <Box sx={{width: 1, display: "flex", justifyContent: "end"}}>
        <Button
          onClick={() => setOpen((open) => !open)}
          endIcon={open ? <Up /> : <Down />}
        >
          <Typography variant="caption">{updateS}</Typography>
        </Button>
      </Box>
      <Box
        sx={{
          display: open ? "block" : "none",
          width: 1,
          bgcolor: "background.default",
        }}
      >
        <Box
          sx={{
            width: 1,
            height: 150,
            bgcolor: "background.default",
          }}
        >
          <ContainerFilesSelector
            onFilesChange={handleFilesChange}
            callToActionLabel={callToActionLabel}
            accept=".yaml,.yml"
            multiple={false}
            loading={loading}
          />
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "end",
            width: 1,
          }}
        >
          <SwitchUseDefault />
        </Box>
      </Box>
    </Box>
  );
}
