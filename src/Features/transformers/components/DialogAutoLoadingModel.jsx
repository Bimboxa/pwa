import { useSelector } from "react-redux";

import { Typography, Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ProgressBarLoadingModel from "./ProgressBarLoadingModel";

export default function DialogAutoLoadingModel() {

    // string

    const loadingS = "Chargement des modèles..."

    // data

    const progressItems = useSelector((state) => state.transformers.progressItems);
    const ready = useSelector((state) => state.transformers.ready);

    console.log("debug_progress_items", progressItems);

    // helpers

    const openProgress = progressItems?.length > 0;

    // render

    //if (!openProgress) return null;

    return (
        <DialogGeneric
            open={openProgress}
            onClose={() => { }}
            width={300}
        >
            <Box sx={{ p: 1 }}>
                <Box>
                    <Typography variant="body2">{loadingS}</Typography>
                </Box>
                <BoxFlexVStretch>
                    {progressItems.map(item => {
                        return <ProgressBarLoadingModel key={item.file} label={item.file} percentage={item.progress} />
                    })}
                </BoxFlexVStretch>
            </Box>
        </DialogGeneric>
    );
}
