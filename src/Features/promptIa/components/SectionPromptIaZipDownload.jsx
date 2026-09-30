import { useEffect, useRef, useState } from "react";

import PropTypes from "prop-types";

import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Typography,
} from "@mui/material";
import { Check, ContentCopy, Download } from "@mui/icons-material";

import formatFileSize from "../utils/formatFileSize";

const COPIED_MS = 1500;

// Zip step of the « Prompt IA » screens: the download button, then what to
// ask the AI chat. `built` is the last generated zip ({ fileName, sizeBytes });
// `children` holds the screen's own alerts.
export default function SectionPromptIaZipDownload({
  onDownload,
  disabled = false,
  building = false,
  built,
  children,
}) {
  // strings

  const downloadS = "Télécharger le zip";
  const dropZipS =
    "Déposez ce zip dans un chat IA (ChatGPT, Claude…) et écrivez :";
  const promptS = "Suis les instructions contenues dans le zip";
  const copyS = "Copier";
  const thenS = "L’IA vous renverra un résultat à importer à l’étape suivante.";

  // state

  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // handlers

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(promptS);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch (e) {
      console.error("[promptIa] copy failed", e);
    }
  }

  // render

  return (
    <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}
      >
        <Button
          variant="contained"
          color="secondary"
          onClick={onDownload}
          disabled={disabled || building}
          startIcon={
            building ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <Download />
            )
          }
          sx={{ flexShrink: 0 }}
        >
          {downloadS}
        </Button>
        {built && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {`${built.fileName} — ${formatFileSize(built.sizeBytes)}`}
          </Typography>
        )}
      </Box>

      {children}

      <Typography variant="body2" color="text.secondary">
        {dropZipS}
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 1.5,
          pr: 0.5,
          py: 0.5,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "action.hover",
        }}
      >
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
          {`« ${promptS} »`}
        </Typography>
        <IconButton
          size="small"
          aria-label={copyS}
          title={copyS}
          onClick={handleCopy}
        >
          {copied ? (
            <Check sx={{ fontSize: 16 }} color="success" />
          ) : (
            <ContentCopy sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {thenS}
      </Typography>
    </Box>
  );
}

SectionPromptIaZipDownload.propTypes = {
  onDownload: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  building: PropTypes.bool,
  built: PropTypes.shape({
    fileName: PropTypes.string,
    sizeBytes: PropTypes.number,
  }),
  children: PropTypes.node,
};
