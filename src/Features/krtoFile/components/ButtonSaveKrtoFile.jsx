import { useSelector } from "react-redux";

import { Download } from "@mui/icons-material";
import { Tooltip } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import createKrtoFile from "../services/createKrtoFile";
import downloadBlob from "Features/files/utils/downloadBlob";

export default function ButtonSaveKrtoFile() {
  // strings

  const saveS = "Enregistrer un fichier KRTO";
  const krtoS = ".krto";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // handlers

  async function handleSave() {
    const file = await createKrtoFile(projectId);
    downloadBlob(file, file.name);
  }
  return (
    <Tooltip title={saveS}>
      <ButtonGeneric
        startIcon={<Download />}
        label={krtoS}
        onClick={handleSave}
      />
    </Tooltip>
  );
}
