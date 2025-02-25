import {useSelector} from "react-redux";

import {Box, Typography, Button} from "@mui/material";
import yaml from "js-yaml";
import downloadBlob from "Features/files/utils/downloadBlob";

export default function SectionSettingsCurrent({onNewClick}) {
  // strings

  const title = "Configuration actuelle";
  const buttonLabel = "Télécharger le fichier de config.";
  const newS = "Nouvelle configuration";

  // data

  const qrcode = useSelector((s) => s.settings.servicesConfigQrCode);
  const servicesConfig = useSelector((s) => s.settings.servicesConfig);

  // handler

  function handleDownload() {
    const yamlContent = yaml.dump(servicesConfig);
    const blob = new Blob([yamlContent], {type: "text/yaml;charset=utf-8"});
    downloadBlob(blob, "services-config.yml");
  }
  return (
    <Box sx={{display: "flex", flexDirection: "column", p: 1}}>
      <Typography variant="h6">{title}</Typography>
      {qrcode && <img src={qrcode} alt="QR code" />}
      <Button variant="contained" onClick={handleDownload}>
        {buttonLabel}
      </Button>
      <Button onClick={onNewClick}>{newS}</Button>
    </Box>
  );
}
