import { useState } from "react";

import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import usePullLastRemoteScopeConfiguration from "Features/remoteScopeConfigurations/hooks/usePullLastRemoteScopeConfiguration";

import { Box, Typography, Button } from "@mui/material";

import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";



export default function SectionPullRemoteScopeConfiguration() {

    // strings

    const updateS = "Télécharger";

    // data

    const appConfig = useAppConfig();
    const lastRemoteConfiguration = useSelector((s) => s.remoteScopeConfigurations.lastRemoteConfiguration);


    const pull = usePullLastRemoteScopeConfiguration();

    // state

    const [loading, setLoading] = useState(false);

    // helpers

    const scopeS = appConfig?.strings?.scope?.nameSingular?.toLowerCase() || "dossier";
    const date = lastRemoteConfiguration?.createdAt ? new Date(lastRemoteConfiguration.createdAt) : null;
    const dateS = date?.toLocaleDateString();
    const userS = lastRemoteConfiguration?.createdBy?.trigram;
    const fileSizeS = stringifyFileSize(lastRemoteConfiguration?.fileSize);

    const warningS = `Les données du ${scopeS} ne sont pas à jour.
    Télécharger la dernière version avant d'enregistrer vos données.`

    const lastVersionS = `Version du ${dateS} créée par ${userS}`

    // handlers

    async function handlePull() {
        setLoading(true);
        await pull();
        setLoading(false);
    }

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ p: 1, bgcolor: theme => theme.palette.error.light, border: theme => `1px solid ${theme.palette.error.main}`, borderRadius: 1 }}>
                <Typography color="white" whiteSpace="pre-line">{warningS}</Typography>

                <Box sx={{ display: "flex", p: 1, justifyContent: "space-between", alignItems: "center", flexDirection: "column" }}>
                    <Box sx={{ p: 1 }}>
                        <Typography color="white" sx={{ fontWeight: "bold" }}>{lastVersionS}</Typography>
                    </Box>
                    <ButtonGeneric variant="contained" onClick={handlePull} loading={loading} label={updateS + " (" + fileSizeS + ")"} />
                </Box>
            </Box>
        </Box>
    );
}