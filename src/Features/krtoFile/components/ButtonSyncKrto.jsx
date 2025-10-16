import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { IconButton, Typography, Box } from "@mui/material";
import { Share, Sync } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import IconButtonCopyString from "Features/layout/components/IconButtonCopyString";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import getKrtoFilePathAsync from "../services/getKrtoFilePathAsync";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import uploadKrtoFile from "../services/uploadKrtoFile";
import createKrtoFile from "../services/createKrtoFile";

export default function ButtonSyncKrto() {
  const API = "https://public.media.bimboxa.com";
  const dispatch = useDispatch();

  // strings

  const title = "Partager votre Krto";
  const description = "Ce lien permet d'accéder à votre krto";

  const saveS = "Mettre à jour le fichier partagé";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const appConfig = useAppConfig();

  // state

  const [open, setOpen] = useState(false);
  const [sharedUrl, setSharedUrl] = useState("");
  const [loading, setLoading] = useState(false);

  // helpers

  const orgaCode = appConfig?.orgaCode;

  // handlers

  async function handleClick() {
    const { encodedPath } = await getKrtoFilePathAsync({
      orgaCode,
      projectId,
    });
    const origin = window.location.origin;
    const _sharedUrl = `${origin}/?dataPath=${encodedPath}`;
    setSharedUrl(_sharedUrl);
    await navigator.clipboard.writeText(_sharedUrl);

    //

    setOpen(true);
  }

  async function handleUpload() {
    setLoading(true);
    await uploadKrtoFile({ orgaCode, projectId });
    setLoading(false);
  }

  return (
    <>
      <ButtonGeneric
        label="Partager"
        onClick={handleClick}
        startIcon={<Share />}
        variant="outlined"
        size="small"
      >
        <Share />
      </ButtonGeneric>

      <DialogGeneric open={open} onClose={() => setOpen(false)} width={350}>
        <BoxFlexVStretch sx={{ p: 1 }}>
          <Typography variant="body1" sx={{ fontWeight: "bold" }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            {description}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
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

          <ButtonGeneric
            label={saveS}
            onClick={handleUpload}
            loading={loading}
          />
        </BoxFlexVStretch>
      </DialogGeneric>
    </>
  );
}
