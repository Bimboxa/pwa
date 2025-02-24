import {useSelector, useDispatch} from "react-redux";

import {setServicesConfig, setServicesConfigQrCode} from "../settingsSlice";

import {Paper} from "@mui/material";
import {Settings} from "@mui/icons-material";

import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";
import IconButtonPopper from "Features/layout/components/IconButtonPopper";

import yamlToJsonAsync from "Features/files/utils/yamlToJsonAsync";
import QRCode from "qrcode";

import {storeServicesConfigInLocalStorage} from "../servicesLocalStorageSettings";

export default function IconButtonPopperSettings() {
  const dispatch = useDispatch();
  // data

  const qrcode = useSelector((s) => s.settings.servicesConfigQrCode);

  // helpers

  const icon = <Settings />;

  // helpers - file selector

  const files = [];
  const accept = ".yaml, .yml";

  // handlers

  async function handleFilesChange(files) {
    const file = files[0];
    const settings = await yamlToJsonAsync(file);
    console.log("settings", settings);
    //
    const qrcode = await QRCode.toDataURL(JSON.stringify(settings));
    //
    storeServicesConfigInLocalStorage(settings);
    //
    dispatch(setServicesConfig(settings));
    dispatch(setServicesConfigQrCode(qrcode));
  }
  return (
    <IconButtonPopper icon={icon}>
      <Paper>
        {qrcode && <img src={qrcode} alt="QR code" />}
        <ContainerFilesSelector
          files={files}
          onFilesChange={handleFilesChange}
          accept={accept}
        />
      </Paper>
    </IconButtonPopper>
  );
}
