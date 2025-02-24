import {Settings} from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import IconButtonDialogFs from "Features/layout/components/IconButtonDialogFs";
import QrCodeReader from "Features/qrcode/components/QrCodeReader";
import {storeSettingsInLocalStorage} from "../servicesLocalStorageSettings";

export default function IconButtonDialogFsSettingsQrCode() {
  // strings

  const title = "Paramétrage";
  const description =
    "Scannez le QR code de paramétrage généré depuis votre ordinateur";

  // helpers

  const icon = <Settings />;

  // handlers

  async function handleScan(qrcode) {
    storeSettingsInLocalStorage(qrcode);
  }

  return (
    <IconButtonDialogFs icon={icon} title={title} onClose={handleClose}>
      <QrCodeReader onScan={handleScan} />
      <BoxFlexVStretch>
        <BoxCenter>{description}</BoxCenter>
      </BoxFlexVStretch>
    </IconButtonDialogFs>
  );
}
