import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import {
    setLastRemoteConfiguration,
    setLastSyncedRemoteConfigurationVersion,
} from "Features/remoteScopeConfigurations/remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import resolveUrl from "Features/appConfig/utils/resolveUrl";
import transformObject from "Features/misc/utils/transformObject";
import resolveRoute from "Features/remoteScopeConfigurations/utils/resolveRoute";
import loadKrtoZip from "Features/krtoFile/services/loadKrtoZip";
import db from "App/db/db";

import { Box, Typography, LinearProgress } from "@mui/material";

export default function PageScopeLoader() {
    const { scopeId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const loadingRef = useRef(false);

    // data

    const appConfig = useAppConfig();
    const jwt = useSelector((s) => s.auth.jwt);

    // config

    const pullConfig = appConfig?.features?.remoteScopeConfigurations?.pull;
    const mapping = appConfig?.features?.remoteScopeConfigurations?.mapping;

    // state

    const [status, setStatus] = useState("init"); // init | checking | fetching_metadata | downloading | importing | done | error
    const [progress, setProgress] = useState(0);
    const [fileSize, setFileSize] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [fadeOut, setFadeOut] = useState(false);

    // helpers

    const statusMessages = {
        init: "Initialisation...",
        checking: "Vérification des données locales...",
        fetching_metadata: "Récupération des informations...",
        downloading: "Téléchargement en cours...",
        importing: "Chargement des données...",
        done: "Prêt",
        error: errorMessage || "Erreur",
    };

    function formatFileSize(bytes) {
        if (!bytes) return "";
        if (bytes < 1024) return `${bytes} o`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    }

    // core logic

    async function loadScope() {
        if (loadingRef.current) return;
        loadingRef.current = true;

        try {
            // 1. Vérifier si le scope existe en local
            setStatus("checking");
            setProgress(10);

            const localScope = await db.scopes.get(scopeId);

            if (localScope) {
                // Le scope existe en local — on le sélectionne et on redirige
                setProgress(100);
                setStatus("done");
                dispatch(setSelectedScopeId(scopeId));
                dispatch(setSelectedProjectId(localScope.projectId));
                finishAndNavigate();
                return;
            }

            // 2. Le scope n'existe pas en local — on fetch les métadonnées
            setStatus("fetching_metadata");
            setProgress(20);

            if (!pullConfig) throw new Error("Configuration de synchronisation manquante");

            const fetchParams = pullConfig.fetchParams;
            if (!fetchParams) throw new Error("fetchParams manquant");

            const urlConfig = {
                ...fetchParams.url,
                route: resolveRoute(fetchParams.url.route, { scopeId }),
            };
            const resolvedUrl = resolveUrl(urlConfig);

            const response = await fetch(resolvedUrl, {
                method: fetchParams.method || "GET",
                headers: {
                    ...(jwt && { Authorization: `Bearer ${jwt}` }),
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Erreur ${response.status} : scope introuvable`);
            }

            const data = await response.json();
            const configuration = mapping ? transformObject(data, mapping) : data;

            dispatch(setLastRemoteConfiguration(configuration));
            setFileSize(configuration.fileSize);
            setProgress(30);

            // 3. Télécharger le fichier ZIP
            if (!configuration.url) {
                throw new Error("URL du fichier manquante");
            }

            setStatus("downloading");

            const fileResponse = await fetch(configuration.url, {
                headers: {
                    ...(jwt && { Authorization: `Bearer ${jwt}` }),
                },
            });

            if (!fileResponse.ok) {
                throw new Error(`Erreur ${fileResponse.status} lors du téléchargement`);
            }

            // Suivi de la progression du téléchargement
            const contentLength = fileResponse.headers.get("content-length");
            const totalBytes = contentLength ? parseInt(contentLength, 10) : configuration.fileSize;

            let receivedBytes = 0;
            const reader = fileResponse.body.getReader();
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedBytes += value.length;
                if (totalBytes) {
                    // 30% → 80% pour le téléchargement
                    const dlProgress = 30 + (receivedBytes / totalBytes) * 50;
                    setProgress(Math.min(dlProgress, 80));
                }
            }

            const blob = new Blob(chunks);
            const file = new File([blob], "remote_scope.zip", { type: "application/zip" });

            // 4. Importer le ZIP
            setStatus("importing");
            setProgress(85);

            await loadKrtoZip(file, { loadDataToScopeId: scopeId });

            setProgress(95);

            // 5. Sélectionner le scope et mettre à jour la synchro
            dispatch(setLastSyncedRemoteConfigurationVersion(configuration.version));

            const importedScope = await db.scopes.get(scopeId);
            if (importedScope) {
                dispatch(setSelectedProjectId(importedScope.projectId));
            }
            dispatch(setSelectedScopeId(scopeId));

            setProgress(100);
            setStatus("done");

            finishAndNavigate();

        } catch (error) {
            console.error("[PageScopeLoader] error", error);
            setStatus("error");
            setErrorMessage(error.message);
        }
    }

    function finishAndNavigate() {
        setFadeOut(true);
        setTimeout(() => {
            navigate("/");
        }, 600);
    }

    // effect

    useEffect(() => {
        if (scopeId && appConfig) {
            loadScope();
        }
    }, [scopeId, !!appConfig]);

    // render

    return (
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                bgcolor: "#0a0a0a",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                transition: "opacity 0.6s ease",
                opacity: fadeOut ? 0 : 1,
            }}
        >
            {/* Barre de progression */}
            <Box sx={{ width: 280 }}>
                <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: "rgba(255,255,255,0.1)",
                        "& .MuiLinearProgress-bar": {
                            borderRadius: 2,
                            bgcolor: "rgba(255,255,255,0.85)",
                        },
                    }}
                />
            </Box>

            {/* Message de statut */}
            <Typography
                sx={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 13,
                    mt: 2,
                    fontWeight: 300,
                    letterSpacing: 0.5,
                }}
            >
                {statusMessages[status]}
            </Typography>

            {/* Taille du fichier pendant le téléchargement */}
            {status === "downloading" && fileSize && (
                <Typography
                    sx={{
                        color: "rgba(255,255,255,0.3)",
                        fontSize: 11,
                        mt: 1,
                        fontWeight: 300,
                    }}
                >
                    {formatFileSize(fileSize)}
                </Typography>
            )}

            {/* Message d'erreur */}
            {status === "error" && (
                <Typography
                    sx={{
                        color: "rgba(255,100,100,0.8)",
                        fontSize: 12,
                        mt: 1,
                        fontWeight: 300,
                    }}
                >
                    {errorMessage}
                </Typography>
            )}
        </Box>
    );
}
