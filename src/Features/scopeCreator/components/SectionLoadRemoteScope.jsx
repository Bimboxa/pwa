import { useState, useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setOpenScopeCreator } from "../scopeCreatorSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopeConfigurationsByProject from "Features/remoteScopeConfigurations/hooks/useScopeConfigurationsByProject";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

import {
    Box,
    Typography,
    List,
    ListItemButton,
    ListItemText,
    CircularProgress,
} from "@mui/material";
import { CloudDownload as CloudIcon } from "@mui/icons-material";

export default function SectionLoadRemoteScope() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // data

    const appConfig = useAppConfig();
    const projectsById = useSelector((s) => s.projects.projectsById);
    const projectId = useSelector((s) => s.scopeCreator.selectedProjectId);
    const project = projectsById[projectId];

    const getByProject = useScopeConfigurationsByProject();

    // state

    const [configurations, setConfigurations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // helpers

    const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";
    const hasResults = configurations.length > 0;

    // effect — recherche au montage si le project a un idMaster

    useEffect(() => {
        if (project?.idMaster) {
            fetchConfigurations();
        }
    }, [project?.idMaster]);

    // handlers

    async function fetchConfigurations() {
        setLoading(true);
        setError(null);
        try {
            const results = await getByProject({ project });
            setConfigurations(results);
        } catch (err) {
            console.error("[SectionLoadRemoteScope] error", err);
            setError(err.message);
        }
        setLoading(false);
    }

    function handleSelectConfiguration(config) {
        // Naviguer vers la page de chargement du scope
        dispatch(setOpenScopeCreator(false));
        navigate(`/scopes/${config.scopeId}`);
    }

    // render — pas de idMaster, pas de section

    if (!project?.idMaster) return null;

    return (
        <Box>
            <Box sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                pt: 2,
                pb: 1,
            }}>
                <CloudIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Charger un {scopeS.toLowerCase()} distant
                </Typography>
            </Box>

            {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                    <CircularProgress size={20} />
                </Box>
            )}

            {error && (
                <Typography variant="caption" color="error" sx={{ px: 2, pb: 1, display: "block" }}>
                    {error}
                </Typography>
            )}

            {!loading && !error && !hasResults && (
                <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 1, display: "block", fontStyle: "italic" }}>
                    Aucun {scopeS.toLowerCase()} distant disponible
                </Typography>
            )}

            {!loading && hasResults && (
                <List dense>
                    {configurations.map((config) => (
                        <ListItemButton
                            key={config.id ?? config.scopeId}
                            divider
                            onClick={() => handleSelectConfiguration(config)}
                        >
                            <ListItemText
                                primary={config.scopeName || `${scopeS} ${config.scopeId}`}
                                secondary={formatSecondary(config)}
                            />
                        </ListItemButton>
                    ))}
                </List>
            )}
        </Box>
    );
}

// --- Helpers ---

function formatSecondary(config) {
    const parts = [];
    if (config.createdBy?.trigram) parts.push(config.createdBy.trigram);
    if (config.created_at) {
        const d = new Date(config.created_at);
        parts.push(d.toLocaleDateString());
    }
    if (config.fileSize) parts.push(stringifyFileSize(config.fileSize));
    if (config.version) parts.push(`v${config.version}`);
    return parts.join(" · ");
}
