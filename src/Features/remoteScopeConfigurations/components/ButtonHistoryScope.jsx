import { useState } from "react";
import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import useAllScopeConfigurations from "../hooks/useAllScopeConfigurations";
import restoreScopeConfigurationService from "../services/restoreScopeConfigurationService";

import {
    Button,
    IconButton,
    Tooltip,
    Popover,
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    Divider,
    CircularProgress,
    Alert,
} from "@mui/material";
import { History as HistoryIcon, Restore as RestoreIcon } from "@mui/icons-material";

import DialogConfirmRestore from "./DialogConfirmRestore";

function formatDate(iso) {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        return d.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

export default function ButtonHistoryScope() {

    // data

    const appConfig = useAppConfig();
    const scopeId = useSelector((s) => s.scopes.selectedScopeId);
    const jwt = useSelector((s) => s.auth.jwt);

    const getAllVersions = useAllScopeConfigurations();

    // state

    const [anchorEl, setAnchorEl] = useState(null);
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [versionToRestore, setVersionToRestore] = useState(null);

    // helpers

    const open = Boolean(anchorEl);

    // handlers

    async function handleOpen(e) {
        setAnchorEl(e.currentTarget);
        setError(null);
        setLoading(true);
        try {
            const items = await getAllVersions({ scopeId });
            // Tri décroissant par version (la plus récente en haut)
            const sorted = [...items].sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
            setVersions(sorted);
        } catch (err) {
            console.error("[ButtonHistoryScope] fetch error", err);
            setError(err.message || "Erreur lors du chargement");
        } finally {
            setLoading(false);
        }
    }

    function handleClose() {
        setAnchorEl(null);
    }

    function handleClickRestore(version) {
        setVersionToRestore(version);
    }

    function handleCancelRestore() {
        setVersionToRestore(null);
    }

    async function handleConfirmRestore() {
        try {
            await restoreScopeConfigurationService({
                scopeId,
                version: versionToRestore,
                appConfig,
                jwt,
            });
            setVersionToRestore(null);
            setAnchorEl(null);
        } catch (err) {
            console.error("[ButtonHistoryScope] restore error", err);
            setError(err.message || "Erreur lors de la restauration");
        }
    }

    if (!scopeId) return null;

    return (
        <>
            <Tooltip title="Historique">
                <IconButton onClick={handleOpen} size="small">
                    <HistoryIcon />
                </IconButton>
            </Tooltip>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { sx: { borderRadius: 2, mt: 0.5, width: 420, maxHeight: 480 } } }}
            >
                <Box sx={{ p: 2, pb: 1 }}>
                    <Typography variant="subtitle2">Historique des versions</Typography>
                </Box>
                <Divider />

                {loading && (
                    <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
                        <CircularProgress size={14} />
                        <Typography variant="caption" color="text.secondary">
                            Chargement...
                        </Typography>
                    </Box>
                )}

                {!loading && error && (
                    <Box sx={{ p: 2 }}>
                        <Alert severity="error" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                                Impossible de charger l'historique
                            </Typography>
                            <Typography variant="caption" component="div" sx={{ fontFamily: "monospace", fontSize: 11 }}>
                                {error}
                            </Typography>
                        </Alert>
                    </Box>
                )}

                {!loading && !error && versions.length === 0 && (
                    <Box sx={{ p: 2 }}>
                        <Alert severity="info">Aucune sauvegarde pour ce Krto.</Alert>
                    </Box>
                )}

                {!loading && !error && versions.length > 0 && (
                    <List dense disablePadding sx={{ overflow: "auto" }}>
                        {versions.map((v, idx) => {
                            const author = v.createdBy?.trigram || "—";
                            const date = formatDate(v.createdAt);
                            return (
                                <Box key={v.id ?? idx}>
                                    {idx > 0 && <Divider component="li" />}
                                    <ListItem
                                        secondaryAction={
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<RestoreIcon />}
                                                onClick={() => handleClickRestore(v)}
                                            >
                                                Restaurer
                                            </Button>
                                        }
                                    >
                                        <ListItemText
                                            primary={`Version ${v.version ?? "?"}`}
                                            secondary={`${author} — ${date}`}
                                        />
                                    </ListItem>
                                </Box>
                            );
                        })}
                    </List>
                )}
            </Popover>

            <DialogConfirmRestore
                open={Boolean(versionToRestore)}
                onClose={handleCancelRestore}
                version={versionToRestore}
                onConfirmAsync={handleConfirmRestore}
            />
        </>
    );
}
