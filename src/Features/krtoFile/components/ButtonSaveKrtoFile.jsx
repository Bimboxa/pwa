import { useSelector } from "react-redux";

import { Download } from "@mui/icons-material";
import { Tooltip } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import createKrtoFile from "../services/createKrtoFile";
import downloadBlob from "Features/files/utils/downloadBlob";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function ButtonSaveKrtoFile() {
  // data

  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // helpers

  const extension = appConfig?.features?.krto?.extension;
  const krtoS = "." + extension ?? ".krto";
  const saveS = `Enregistrer un fichier ${krtoS}`;

  // handlers

  async function handleSave() {
    const file = await createKrtoFile(projectId, { krtoExtension: extension });
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
