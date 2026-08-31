import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedVersionId } from "Features/versions/versionsSlice";

import { Typography } from "@mui/material";

import PageGeneric from "Features/layout/components/PageGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";
import CircularProgressGeneric from "Features/layout/components/CircularProgressGeneric";

import downloadAndLoadKrtoVersionService from "Features/versions/services/downloadAndLoadKrtoVersionService";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function PageDownloadKrtro() {
  const syncingRef = useRef();
  const downloadingRef = useRef({});
  const dispatch = useDispatch();
  const { mediaId } = useParams();
  const navigate = useNavigate();
  //const API = "https://public.media.bimboxa.com";

  // data

  const appConfig = useAppConfig();

  // strings

  const loadingS =
    appConfig?.strings?.scope?.loading ?? "Chargement du plan de repérage";

  // state

  const [loading, setLoading] = useState(null);
  const [progress, setProgress] = useState(0);

  // helper - download

  async function downloadKrto(mediaId) {
    if (syncingRef.current || downloadingRef?.current[mediaId]) return;

    syncingRef.current = true;
    downloadingRef.current[mediaId] = true;

    console.log("DOWNLOAD mediaId", mediaId);

    const project = await downloadAndLoadKrtoVersionService({
      id: mediaId,
      onProgress: setProgress,
    });
    if (project) dispatch(setSelectedProjectId(project.id));

    dispatch(setSelectedVersionId(mediaId));
    navigate("/");

    syncingRef.current = false;
  }

  // effect

  useEffect(() => {
    if (mediaId && !syncingRef?.current) {
      downloadKrto(mediaId);
    }
  }, [mediaId, syncingRef?.current]);

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
