import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";

import PageGeneric from "Features/layout/components/PageGeneric";

import BoxCenter from "Features/layout/components/BoxCenter";
import CircularProgressGeneric from "Features/layout/components/CircularProgressGeneric";
import fetchMediaService from "Features/sync/services/fetchMediaService";

import loadKrtoFile from "../services/loadKrtoFile";
import krtoZipToKrtoFile from "../services/krtoZipToKrtoFile";

export default function PageDownloadKrtro() {
  const dispatch = useDispatch();
  const { krtoPath } = useParams();
  const navigate = useNavigate();

  // state

  const [loading, setLoading] = useState(null);
  const [progress, setProgress] = useState(0);

  // helper - download

  async function downloadKrto() {
    const blob = await fetchMediaService({
      path: krtoPath,
      onProgress: setProgress,
    });
    const krtoFile = await krtoZipToKrtoFile(blob);
    const project = await loadKrtoFile(krtoFile);
    if (project) dispatch(setSelectedProjectId(project.id));
    navigate("/");
  }

  // effect

  useEffect(() => {
    console.log("[DOWNLOAD] krtoPath", krtoPath);
    if (krtoPath) {
      downloadKrto();
    }
  }, [krtoPath]);

  return (
    <PageGeneric>
      <BoxCenter>
        <CircularProgressGeneric value={progress * 100} />
      </BoxCenter>
    </PageGeneric>
  );
}
