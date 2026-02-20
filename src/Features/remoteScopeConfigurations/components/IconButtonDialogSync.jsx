import { useState } from "react";

import { useSelector } from "react-redux";

import { Badge, IconButton, Box } from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";

import usePullLastRemoteScopeConfiguration from "../hooks/usePullLastRemoteScopeConfiguration";
import DialogSync from "./DialogSync";


export default function IconButtonDialogSync() {

    // data

    const lastRemoteConfiguration = useSelector((s) => s.remoteScopeConfigurations.lastRemoteConfiguration);
    const lastSyncedRemoteConfigurationVersion = useSelector((s) => s.remoteScopeConfigurations.lastSyncedRemoteConfigurationVersion);

    const pullLastConfig = usePullLastRemoteScopeConfiguration();

    // state

    const [open, setOpen] = useState(false);

    // helpers

    const isPullRequired =
        !lastSyncedRemoteConfigurationVersion ||
        !lastRemoteConfiguration ||
        lastRemoteConfiguration.version > lastSyncedRemoteConfigurationVersion;


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
            <IconButton onClick={handleOpen} size="small">
                <Badge badgeContent={isPullRequired ? 1 : 0} color="error" variant="dot" size="small">
                    <SyncIcon />
                </Badge>

            </IconButton>
            <DialogSync open={open} onClose={handleClose} isPullRequired={isPullRequired} />
        </Box>
    );
}
