import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";

import { CircularProgress, Typography } from "@mui/material";

import PageGeneric from "Features/layout/components/PageGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";
import CircularProgressGeneric from "Features/layout/components/CircularProgressGeneric";
import fetchMediaService from "Features/sync/services/fetchMediaService";

import loadKrtoFile from "../services/loadKrtoFile";
import krtoZipToKrtoFile from "../services/krtoZipToKrtoFile";

export default function PageDownloadKrtro() {
  const syncingRef = useRef();
  const downloadingRef = useRef({});
  const dispatch = useDispatch();
  const { krtoPath } = useParams();
  const navigate = useNavigate();
  //const API = "https://public.media.bimboxa.com";

  // strings

  const loadingS = "Chargement Krto";

  // state

  const [loading, setLoading] = useState(null);
  const [progress, setProgress] = useState(0);

  // helper - download

  async function downloadKrto(krtoPath) {
    if (syncingRef.current || downloadingRef?.current[krtoPath]) return;

    syncingRef.current = true;
    downloadingRef.current[krtoPath] = true;

    console.log("DOWNLOAD krtoPath", krtoPath);

    const blob = await fetchMediaService({
      path: krtoPath,
      onProgress: setProgress,
    });

    const krtoFile = await krtoZipToKrtoFile(blob);
    const project = await loadKrtoFile(krtoFile);
    if (project) dispatch(setSelectedProjectId(project.id));
    navigate("/");

    syncingRef.current = false;
  }

  // effect

  useEffect(() => {
    if (krtoPath && !syncingRef?.current) {
      downloadKrto(krtoPath);
    }
  }, [krtoPath, syncingRef?.current]);

  return (
    <PageGeneric>
      <BoxCenter sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <CircularProgressGeneric value={progress * 100} />
        {/* {loading && <CircularProgress />} */}
        <Typography alignment="center">{loadingS}</Typography>
      </BoxCenter>
    </PageGeneric>
  );
}
