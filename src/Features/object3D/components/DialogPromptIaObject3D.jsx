import { useState } from "react";

import PropTypes from "prop-types";

import {
  Alert,
  Box,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Close } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import FieldPromptIaContext from "Features/promptIa/components/FieldPromptIaContext";
import ListPromptIaFiles from "Features/promptIa/components/ListPromptIaFiles";
import SectionPromptIaZipDownload from "Features/promptIa/components/SectionPromptIaZipDownload";

import buildPromptIaObject3DZip from "../services/buildPromptIaObject3DZip";
import {
  PROMPT_IA_ATTACH_ACCEPT,
  getFileExtension,
  getPromptIaAttachmentRejection,
} from "Features/promptIa/utils/promptIaAttachmentTypes";
import {
  describeTooLarge,
  isResourceFileTooLarge,
} from "Features/resources/constants/resourceLimits";

const DESCRIPTION_MAX_LENGTH = 4000;

// 3D references the user may hand to the AI (an existing model to adapt…),
// on top of the Prompt IA attachment types.
const REFERENCE_3D_EXTENSIONS = ["glb", "gltf", "obj", "stl"];
const ATTACH_ACCEPT = [
  PROMPT_IA_ATTACH_ACCEPT,
  ...REFERENCE_3D_EXTENSIONS.map((ext) => `.${ext}`),
].join(",");

function getFileKey(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

// → null when the file is accepted, else a French, user-facing reason.
function getRejection(file) {
  if (isResourceFileTooLarge(file)) return describeTooLarge(file);
  if (REFERENCE_3D_EXTENSIONS.includes(getFileExtension(file?.name)))
    return null;
  return getPromptIaAttachmentRejection(file);
}

// Prompt IA of the « Objet 3D » field, in a single step: the user describes
// the object (text, dictation, pictures / documents), downloads the prompt
// zip and hands it to an external AI chat, which gives back a `.glb` to drop
// in the field. The attached files stay in memory, nothing is stored in the
// project.
export default function DialogPromptIaObject3D({ open, onClose, objectName }) {
  // strings

  const captionS = "Objet 3D";
  const titleS = "Prompt IA";
  const closeS = "Fermer";
  const placeholderS =
    "Décrivez l’objet : type, dimensions (largeur × profondeur × hauteur), matériaux, couleurs…";
  const hintS = "Glissez-déposez une image, un PDF ou un fichier de référence";
  const attachHelpS =
    "Joignez des photos, un croquis, une fiche technique ou un modèle 3D de référence : 50 Mo au plus par fichier. Les fichiers joints ne sont pas enregistrés dans le projet.";
  const downloadS = "Télécharger le zip du prompt";
  const followUpS =
    "L’IA vous renverra un fichier .glb : glissez-le dans la zone « Objet 3D » du modèle.";
  const zipContentS =
    "Le zip contient les consignes de modélisation, votre description et les pièces jointes.";

  // state

  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [attachErrors, setAttachErrors] = useState([]);
  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState(null);
  const [buildError, setBuildError] = useState(null);

  // helpers

  const fileItems = files.map((file) => ({
    key: getFileKey(file),
    label: file.name,
    sizeBytes: file.size,
  }));
  const canDownload = Boolean(description.trim()) || files.length > 0;

  // handlers

  function handleDescriptionChange(text) {
    setDescription(text);
    setBuilt(null);
  }

  function handleAddFiles(fileList) {
    const added = Array.from(fileList ?? []);
    if (added.length === 0) return;
    const errors = [];
    const kept = [];
    for (const file of added) {
      const rejection = getRejection(file);
      if (rejection) errors.push(rejection);
      else kept.push(file);
    }
    setAttachErrors(errors);
    if (kept.length === 0) return;
    setFiles((current) => {
      const keys = new Set(current.map(getFileKey));
      return [...current, ...kept.filter((f) => !keys.has(getFileKey(f)))];
    });
    setBuilt(null);
  }

  function handleRemoveFile(key) {
    setFiles((current) => current.filter((f) => getFileKey(f) !== key));
    setBuilt(null);
  }

  // A file dropped next to the field must neither make the browser navigate
  // to it nor reach the « Objet 3D » drop zone behind the dialog.
  function handleStrayDrop(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDownload() {
    setBuilding(true);
    setBuildError(null);
    try {
      const result = await buildPromptIaObject3DZip({
        name: objectName,
        description,
        files,
      });
      setBuilt(result);
    } catch (err) {
      setBuildError(err?.message ?? String(err));
    } finally {
      setBuilding(false);
    }
  }

  // render

  return (
    <DialogGeneric
      open={open}
      onClose={onClose}
      width={560}
      onDrop={handleStrayDrop}
      onDragOver={handleStrayDrop}
      // clicks must not bubble (React portal) to the form behind the dialog
      onClick={(e) => e.stopPropagation()}
      title={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1.4,
              }}
            >
              {captionS}
            </Typography>
            <Typography variant="h6" noWrap sx={{ fontWeight: "bold" }}>
              {titleS}
            </Typography>
          </Box>
          <Tooltip title={closeS}>
            <IconButton size="small" onClick={onClose}>
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      }
    >
      <Stack
        spacing={1.5}
        sx={{ p: 2, bgcolor: "background.default", overflowY: "auto" }}
      >
        <FieldPromptIaContext
          value={description}
          onChange={handleDescriptionChange}
          placeholder={placeholderS}
          maxLength={DESCRIPTION_MAX_LENGTH}
          accept={ATTACH_ACCEPT}
          onFiles={handleAddFiles}
          hint={hintS}
        >
          <ListPromptIaFiles items={fileItems} onRemove={handleRemoveFile} />
        </FieldPromptIaContext>
        <Typography variant="caption" color="text.secondary">
          {attachHelpS}
        </Typography>

        {attachErrors.map((message) => (
          <Alert
            key={message}
            severity="error"
            onClose={() =>
              setAttachErrors((list) => list.filter((m) => m !== message))
            }
          >
            {message}
          </Alert>
        ))}

        <Box sx={{ pt: 1 }}>
          <SectionPromptIaZipDownload
            onDownload={handleDownload}
            disabled={!canDownload}
            building={building}
            built={built}
            label={downloadS}
            followUp={followUpS}
          >
            {built && (
              <Alert severity="success">
                Zip prêt : {built.files.join(", ")}.
              </Alert>
            )}
            {buildError && <Alert severity="error">{buildError}</Alert>}
          </SectionPromptIaZipDownload>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {zipContentS}
        </Typography>
      </Stack>
    </DialogGeneric>
  );
}

DialogPromptIaObject3D.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  objectName: PropTypes.string,
};
