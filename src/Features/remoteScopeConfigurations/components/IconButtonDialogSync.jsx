import { useState } from "react";

import { useSelector } from "react-redux";

import { Badge, Button, Box } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";

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
                    startIcon={<SaveIcon />}
                >
                    Sauvegarder
                </Button>
            </Badge>
            <DialogSync open={open} onClose={handleClose} isPullRequired={isPullRequired} />
        </Box>
    );
}
