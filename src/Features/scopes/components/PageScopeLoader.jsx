import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import {
    setLastRemoteConfiguration,
    setLastSyncedRemoteConfigurationVersion,
} from "Features/remoteScopeConfigurations/remoteScopeConfigurationsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import downloadRemoteScopeService from "Features/remoteScopeConfigurations/services/downloadRemoteScopeService";
import db from "App/db/db";

import { Box, Typography, LinearProgress } from "@mui/material";

export default function PageScopeLoader() {
    const { scopeId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();
    const loadingRef = useRef(false);

    // data

    const appConfig = useAppConfig();
    const jwt = useSelector((s) => s.auth.jwt);

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

            // 2. Le scope n'existe pas en local — métadonnées, téléchargement
            // du ZIP et import (service partagé, sans sélection ni navigation)
            const { configuration, scope: importedScope } =
                await downloadRemoteScopeService({
                    scopeId,
                    appConfig,
                    jwt,
                    onProgress: ({ status, progress, fileSize }) => {
                        setStatus(status);
                        setProgress(progress);
                        if (fileSize) setFileSize(fileSize);
                    },
                });

            // 3. Sélectionner le scope et mettre à jour la synchro
            if (importedScope) {
                dispatch(setSelectedProjectId(importedScope.projectId));
            }
            // Set scopeId BEFORE synced version so the middleware can persist to localStorage
            // setSelectedScopeId resets the per-scope remote state: re-apply
            // the configuration fetched above for the now-selected scope.
            dispatch(setSelectedScopeId(scopeId));
            dispatch(setLastRemoteConfiguration(configuration));
            dispatch(setLastSyncedRemoteConfigurationVersion(configuration.version));

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
            navigate({ pathname: "/", search: location.search });
        }, 600);
    }

    // effect

    useEffect(() => {
        if (scopeId && appConfig && jwt) {
            loadScope();
        }
    }, [scopeId, !!appConfig, jwt]);

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
