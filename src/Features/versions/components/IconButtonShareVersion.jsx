import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import useVersion from "../hooks/useVersion";

import { IconButton, Typography, Box } from "@mui/material";
import { Share, Sync } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import IconButtonCopyString from "Features/layout/components/IconButtonCopyString";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import createQrCodeImageData from "Features/qrcode/utils/createQrcodeImageData";

export default function IconButtonShareVersion() {
  // strings

  const title = "Partager votre Krto";
  const description = "Ce lien permet d'accéder à votre krto";
  const mobileAccessS =
    "Flashez ce QR pour accéder au Krto depuis votre mobile";

  // data
  const version = useVersion();

  // state

  const [open, setOpen] = useState(false);
  const [sharedUrl, setSharedUrl] = useState("");

  const [qrcode, setQrcode] = useState(null);

  // handlers

  async function handleClick() {
    const origin = window.location.origin;
    const _sharedUrl = `${origin}/download/${version.id}`;

    setSharedUrl(_sharedUrl);
    const _qrcode = await createQrCodeImageData(_sharedUrl, { size: 256 });
    setQrcode(_qrcode);

    //

    setOpen(true);
  }

  return (
    <>
      <IconButton
        label="Partager"
        onClick={handleClick}
        startIcon={<Share />}
        variant="outlined"
        size="small"
      >
        <Share />
      </IconButton>

      {open && (
        <DialogGeneric open={open} onClose={() => setOpen(false)} width={350}>
          <BoxFlexVStretch sx={{ p: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: "bold" }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
              {description}
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 3,
                flexDirection: "column",
              }}
            >
              <Typography
                noWrap
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 0 }}
              >
                {sharedUrl}
              </Typography>
              <Box sx={{ flexGrow: 1 }}>
                <IconButtonCopyString
                  string={sharedUrl}
                  label="Copier le lien"
                  variant="button"
                />
              </Box>
            </Box>

            <Box
              sx={{
                width: 1,
                display: "flex",
                justifyContent: "center",
                mb: 3,
                flexDirection: "column",
              }}
            >
              <img src={qrcode} />
              <Typography variant="caption" color="text.secondary">
                {mobileAccessS}
              </Typography>
            </Box>
          </BoxFlexVStretch>
        </DialogGeneric>
      )}
    </>
  );
}
