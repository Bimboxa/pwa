import { useState } from "react";

import usePushRemoteScopeConfiguration from "../hooks/usePushRemoteScopeConfiguration";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, DialogTitle } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionPullRemoteScopeConfiguration from "./SectionPullRemoteScopeConfiguration";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function DialogSync({ open, onClose, isPullRequired }) {

    // data

    const push = usePushRemoteScopeConfiguration();
    const appConfig = useAppConfig();

    // state

    const [loading, setLoading] = useState(false);

    // helper

    const scopeS = appConfig?.strings?.scope?.nameSingular?.toLowerCase() || "dossier";
    const pushS = `Enregistrer`;
    const titleS = `Enregistrement du ${scopeS}`;

    // handlers

    function handleClose() {
        onClose();
    }

    async function handlePush() {
        setLoading(true);
        await push();
        setLoading(false);
        onClose();
    }

    return (
        <DialogGeneric
            open={open}
            onClose={handleClose}
        >
            <DialogTitle>
                {titleS}
            </DialogTitle>

            {isPullRequired && <SectionPullRemoteScopeConfiguration />}

            <Box sx={{ p: 1, width: 1 }}>
                <ButtonGeneric
                    variant="contained" loading={loading}
                    //disabled={isPullRequired}
                    color="primary"
                    onClick={handlePush} label={pushS} fullWidth />
            </Box>


        </DialogGeneric>
    );
}