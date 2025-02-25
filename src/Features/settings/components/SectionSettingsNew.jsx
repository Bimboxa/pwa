import {useDispatch} from "react-redux";

import {setServicesConfig, setServicesConfigQrCode} from "../settingsSlice";

import {Box, Typography, Button} from "@mui/material";

import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import yamlToJsonAsync from "Features/files/utils/yamlToJsonAsync";
import {storeServicesConfigInLocalStorage} from "../servicesLocalStorageSettings";

import QRCode from "qrcode";

export default function SectionSettingsNew({onCancel, onNewConfig}) {
  const dispatch = useDispatch();

  // strings

  const title = "Nouvelle configuration";
  const buttonLabel = "Annuler";

  // helpers - file selector

  const files = [];
  const accept = ".yaml, .yml";

  // handlers

  async function handleFilesChange(files) {
    const file = files[0];
    const settings = await yamlToJsonAsync(file);
    //
    const qrcode = await QRCode.toDataURL(JSON.stringify(settings));
    //
    storeServicesConfigInLocalStorage(settings);
    //
    dispatch(setServicesConfig(settings));
    dispatch(setServicesConfigQrCode(qrcode));
    //
    if (onNewConfig) onNewConfig();
  }
  // handler

  function handleCancel() {
    if (onCancel) onCancel();
  }
  return (
    <Box sx={{display: "flex", flexDirection: "column", p: 1}}>
      <Typography variant="h6">{title}</Typography>
      <ContainerFilesSelector
        files={files}
        onFilesChange={handleFilesChange}
        accept={accept}
      />
      <Button onClick={handleCancel}>{buttonLabel}</Button>
    </Box>
  );
}
