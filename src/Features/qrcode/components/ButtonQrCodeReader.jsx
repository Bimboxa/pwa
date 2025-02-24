import {useState} from "react";

import {IconButton, Typography} from "@mui/material";

import {QrCodeScanner} from "@mui/icons-material";

import QrCodeReader from "./QrCodeReader";
import DialogFs from "Features/layout/components/DialogFs";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function ButtonQrCodeReader({onScan}) {
  // string

  const scanS = "Scanner le QR code de l'appareil sur lequel vous connecter";

  // state

  const [open, setOpen] = useState(false);

  // handlers

  function handleClick() {
    setOpen(true);
  }

  function handleScan(qrcode) {
    if (onScan) {
      console.log("[scanning qrcode...]", qrcode);
      onScan(qrcode);
    }
    setOpen(false);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <IconButton onClick={handleClick}>
        <QrCodeScanner />
      </IconButton>
      {open && (
        <DialogFs open={open} onClose={handleClose} onScan={handleScan}>
          <QrCodeReader onScan={handleScan} />
          <BoxFlexVStretch>
            <BoxCenter sx={{p: 3}}>
              <Typography variant="h6" align="center">
                {scanS}
              </Typography>
            </BoxCenter>
          </BoxFlexVStretch>
        </DialogFs>
      )}
    </>
  );
}
