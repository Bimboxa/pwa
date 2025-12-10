
import { useState, useEffect } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Box } from "@mui/material";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import testObjectHasProp from "Features/misc/utils/testObjectHasProp";

import db from "App/db/db";

import migrateLegacyAnnotations from "../services/migrateLegacyAnnotations";

export default function DialogAutoMigrateToMapEditorV3() {

    // data

    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const annotations = useLiveQuery(() => db.annotations.where("projectId").equals(projectId).toArray(), [projectId]);


    // state - open

    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // helpers - legacy detection
    let legacyAnnotations = [];

    annotations?.forEach((annotation) => {
        if (annotation.points?.length > 0) {
            const pointO = annotation.points[0];
            if (testObjectHasProp(pointO, "x")) legacyAnnotations.push(annotation);
        } else if (testObjectHasProp(annotation, "x")) {
            legacyAnnotations.push(annotation);
        }
    });

    const isLegacy = legacyAnnotations.length > 0;

    // effect - open

    useEffect(() => {
        setOpen(isLegacy);
    }, [isLegacy]);

    // handlers
    const handleMigrate = async () => {
        setLoading(true);
        if (!legacyAnnotations.length) return;
        await migrateLegacyAnnotations(legacyAnnotations);
        setLoading(false);
    };

    return (
        <DialogGeneric
            title={"Migration vers Krto 1.2"}
            open={open}
            onClose={() => setOpen(false)}
        >
            <Box sx={{ p: 3 }}>
                <ButtonGeneric label="Migrer" onClick={handleMigrate} loading={loading} />
            </Box>

        </DialogGeneric >
    );
}