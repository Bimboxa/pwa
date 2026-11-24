import { useRef, useState } from "react";

import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import { Box, Button, CircularProgress, Typography } from "@mui/material";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import UploadOutlined from "@mui/icons-material/UploadOutlined";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import {
  buildOrthophotosArchiveZip,
  importOrthophotosArchiveService,
  readOrthophotosArchiveZip,
} from "../services/orthophotosArchiveServices";

// « Sauvegarde des orthophotos » of the Orthophotos tool. The Krto only
// saves the resulting image of an orthomosaic: the original photos, the
// rectified images and their placement stay on this device. This section
// saves them apart, in their own zip, and loads such a zip back
// (services/orthophotosArchiveServices).
export default function SectionOrthophotosArchive({ baseMap, orthophotos }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Sauvegarde des orthophotos";
  const helpS =
    "Le Krto n'enregistre que l'image du fond de plan. Les photos d'origine, les orthophotos unitaires et leur calage restent sur cet appareil : sauvegardez-les dans un zip à part, rechargeable ici.";
  const exportS = "Enregistrer le zip";
  const importS = "Charger un zip";

  // state

  const inputRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [info, setInfo] = useState(null);

  // helpers

  const toast = (message, severity = "info") =>
    dispatch(setToaster({ message, severity }));

  // handlers

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await buildOrthophotosArchiveZip({ baseMap });
      if (!result.ok) {
        toast(result.error, "warning");
        return;
      }
      setInfo(
        `${result.fileName} — ${result.count} orthophoto(s), ${stringifyFileSize(result.sizeBytes)}`
      );
      if (result.missingFiles > 0) {
        toast(
          `${result.missingFiles} image(s) absente(s) de cet appareil : non sauvegardée(s).`,
          "warning"
        );
      }
    } catch (e) {
      console.error("[orthophotos] archive export failed", e);
      toast(`Sauvegarde impossible : ${e?.message ?? e}`, "error");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || importing) return;
    setImporting(true);
    try {
      const archive = await readOrthophotosArchiveZip(file);
      if (!archive.ok) {
        toast(archive.error, "error");
        return;
      }
      const result = await importOrthophotosArchiveService({
        baseMap,
        archive,
      });
      setInfo(null);
      toast(
        `${result.added} orthophoto(s) ajoutée(s), ${result.replaced} remplacée(s)${
          result.frameMismatch
            ? " — la sauvegarde vient d'une image de proportions différentes : vérifiez le calage"
            : ""
        }`,
        result.frameMismatch ? "warning" : "success"
      );
    } catch (err) {
      console.error("[orthophotos] archive import failed", err);
      toast(`Chargement impossible : ${err?.message ?? err}`, "error");
    } finally {
      setImporting(false);
    }
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
        {titleS}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1 }}
      >
        {helpS}
      </Typography>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={
            exporting ? <CircularProgress size={14} /> : <DownloadOutlined />
          }
          disabled={exporting || orthophotos.length === 0}
          onClick={handleExport}
        >
          {exportS}
        </Button>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={
            importing ? <CircularProgress size={14} /> : <UploadOutlined />
          }
          disabled={importing}
          onClick={() => inputRef.current?.click()}
        >
          {importS}
        </Button>
      </Box>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={handleImport}
      />
      {info && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.5, overflowWrap: "anywhere" }}
        >
          {info}
        </Typography>
      )}
    </WhiteSectionGeneric>
  );
}
