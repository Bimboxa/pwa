import { useState, useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import { restoreSyncedVersionFromStorage } from "../remoteScopeConfigurationsSlice";

import { Badge, Button, Box } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

import usePullLastRemoteScopeConfiguration from "../hooks/usePullLastRemoteScopeConfiguration";
import DialogSync from "./DialogSync";


export default function IconButtonDialogSync() {
    const dispatch = useDispatch();

    // data

    const scopeId = useSelector((s) => s.scopes.selectedScopeId);
    const lastRemoteConfiguration = useSelector((s) => s.remoteScopeConfigurations.lastRemoteConfiguration);
    const lastSyncedRemoteConfigurationVersion = useSelector((s) => s.remoteScopeConfigurations.lastSyncedRemoteConfigurationVersion);

    // effects

    useEffect(() => {
        if (scopeId) {
            dispatch(restoreSyncedVersionFromStorage(scopeId));
        }
    }, [scopeId, dispatch]);

    const pullLastConfig = usePullLastRemoteScopeConfiguration();

    // state

    const [open, setOpen] = useState(false);

    // helpers

    const isPullRequired =
        lastRemoteConfiguration
        && lastRemoteConfiguration.version > (lastSyncedRemoteConfigurationVersion ?? 0);


    // handlers

    async function handleOpen() {
        setOpen(true);
        try {
            await pullLastConfig();
        } catch (error) {
            console.error("[IconButtonDialogSync] pull error", error);
        }
    }
    function handleClose() {
        setOpen(false);
    }


    return (
        <Box>
            <Badge color="error" variant="dot" invisible={!isPullRequired}>
                <Button
                    onClick={handleOpen}
                    size="small"
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                >
                    Sauvegarder
                </Button>
            </Badge>
            <DialogSync open={open} onClose={handleClose} isPullRequired={isPullRequired} />
        </Box>
    );
}
