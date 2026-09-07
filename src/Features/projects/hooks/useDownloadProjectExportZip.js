import { useState } from "react";

import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import createProjectExportZip from "../services/createProjectExportZip";
import downloadBlob from "Features/files/utils/downloadBlob";

// Dashboard "Télécharger les données du projet": builds the full project
// export zip (createProjectExportZip) and hands it to the browser.
export default function useDownloadProjectExportZip() {
  const dispatch = useDispatch();

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function download({ projectId }) {
    if (!projectId || loading) return null;
    setLoading(true);
    try {
      const file = await createProjectExportZip(projectId);
      downloadBlob(file, file.name);
      dispatch(
        setToaster({
          message: `Données du projet téléchargées (${file.name})`,
          severity: "success",
        })
      );
      return file;
    } catch (error) {
      console.error("[useDownloadProjectExportZip] export error", error);
      dispatch(
        setToaster({
          message: `Échec de l'export : ${error.message || "erreur inconnue"}`,
          severity: "error",
        })
      );
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { download, loading };
}
