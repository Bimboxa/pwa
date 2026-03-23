import { useState, useRef } from "react";
import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import usePullLastRemoteScopeConfiguration from "Features/remoteScopeConfigurations/hooks/usePullLastRemoteScopeConfiguration";
import useFetchScopeConfiguration from "Features/remoteScopeConfigurations/hooks/useFetchScopeConfiguration";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

import {
    Button,
    IconButton,
    Popover,
    Box,
    Typography,
    InputBase,
    Tooltip,
    CircularProgress,
    Alert,
} from "@mui/material";
import {
    Share as ShareIcon,
    Check as CheckIcon,
    ContentCopy as CopyIcon,
    WarningAmber as WarningIcon,
} from "@mui/icons-material";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function IconButtonShareScope() {

    // data

    const appConfig = useAppConfig();
    const scopeId = useSelector((s) => s.scopes.selectedScopeId);
    const lastRemoteConfiguration = useSelector((s) => s.remoteScopeConfigurations.lastRemoteConfiguration);
    const lastSyncedVersion = useSelector((s) => s.remoteScopeConfigurations.lastSyncedRemoteConfigurationVersion);

    const pullLastConfig = usePullLastRemoteScopeConfiguration();
    const fetchConfiguration = useFetchScopeConfiguration();

    // state

    const [anchorEl, setAnchorEl] = useState(null);
    const [copied, setCopied] = useState(false);
    const [pulling, setPulling] = useState(false);
    const [fetching, setFetching] = useState(false);
    const inputRef = useRef(null);

    // helpers

    const scopeS = appConfig?.strings?.scope?.nameSingular?.toLowerCase() || "dossier";
    const shareUrl = scopeId ? `${window.location.origin}/scopes/${scopeId}` : "";
    const open = Boolean(anchorEl);

    const hasRemoteConfig = Boolean(lastRemoteConfiguration);
    const isPullRequired = hasRemoteConfig
        && lastSyncedVersion
        && lastRemoteConfiguration.version > lastSyncedVersion;

    const isShareReady = hasRemoteConfig && !isPullRequired;

    const date = lastRemoteConfiguration?.createdAt ? new Date(lastRemoteConfiguration.createdAt) : null;
    const dateS = date?.toLocaleDateString();
    const userS = lastRemoteConfiguration?.createdBy?.trigram;
    const fileSizeS = stringifyFileSize(lastRemoteConfiguration?.fileSize);

    // handlers

    async function handleOpen(e) {
        setAnchorEl(e.currentTarget);
        setCopied(false);

        // Pull les métadonnées au passage
        setPulling(true);
        try {
            await pullLastConfig();
        } catch (error) {
            console.error("[IconButtonShareScope] pull error", error);
        }
        setPulling(false);
    }

    function handleClose() {
        setAnchorEl(null);
    }

    async function handleCopy() {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    async function handleFetch() {
        setFetching(true);
        try {
            await fetchConfiguration();
        } catch (error) {
            console.error("[IconButtonShareScope] fetch error", error);
        }
        setFetching(false);
    }

    if (!scopeId) return null;

    return (
        <>
            <Button
                onClick={handleOpen}
                size="small"
                variant="outlined"
                startIcon={<ShareIcon />}
            >
                Partager
            </Button>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { sx: { borderRadius: 2, mt: 0.5, width: 380 } } }}
            >
                <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        Partager le {scopeS}
                    </Typography>

                    {/* Loading state */}
                    {pulling && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
                            <CircularProgress size={14} />
                            <Typography variant="caption" color="text.secondary">
                                Vérification de la version distante...
                            </Typography>
                        </Box>
                    )}

                    {/* No remote config yet */}
                    {!pulling && !hasRemoteConfig && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                            Aucune sauvegarde serveur n'a été effectuée.
                            Veuillez d'abord sauvegarder vos données avant de partager.
                        </Alert>
                    )}

                    {/* Pull required: version mismatch */}
                    {!pulling && isPullRequired && (
                        <Box>
                            <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
                                La version locale n'est pas à jour avec la version serveur.
                                Téléchargez la dernière version ou effectuez une nouvelle sauvegarde.
                            </Alert>
                            <Box
                                sx={{
                                    p: 1.5,
                                    bgcolor: "grey.50",
                                    borderRadius: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1,
                                }}
                            >
                                <Typography variant="caption" color="text.secondary">
                                    Version du {dateS} par {userS} ({fileSizeS})
                                </Typography>
                                <ButtonGeneric
                                    variant="contained"
                                    size="small"
                                    label="Télécharger la dernière version"
                                    onClick={handleFetch}
                                    loading={fetching}
                                />
                            </Box>
                        </Box>
                    )}

                    {/* Share ready: show URL */}
                    {!pulling && isShareReady && (
                        <>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                                Partagez ce lien pour permettre l'accès à ce {scopeS}.
                                L'utilisateur pourra charger les données directement depuis ce lien.
                            </Typography>

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    bgcolor: "grey.100",
                                    borderRadius: 1,
                                    px: 1.5,
                                    py: 0.5,
                                }}
                            >
                                <InputBase
                                    ref={inputRef}
                                    value={shareUrl}
                                    readOnly
                                    fullWidth
                                    sx={{ fontSize: 13, color: "text.secondary" }}
                                    onClick={(e) => e.target.select()}
                                />
                                <Tooltip title={copied ? "Copié !" : "Copier"}>
                                    <IconButton size="small" onClick={handleCopy}>
                                        {copied
                                            ? <CheckIcon fontSize="small" color="success" />
                                            : <CopyIcon fontSize="small" />
                                        }
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </>
                    )}
                </Box>
            </Popover>
        </>
    );
}
