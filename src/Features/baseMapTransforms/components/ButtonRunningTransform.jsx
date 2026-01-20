import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { keyframes } from "@emotion/react"; // Ou styled-components selon votre setup

// UI Components
import { Box, CircularProgress } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle"; // Assurez-vous d'avoir @mui/icons-material

import { clearEnhancedImageResult } from "Features/baseMaps/baseMapsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateBaseMapWithImageEnhanced from "Features/baseMaps/hooks/useUpdateBaseMapWithImageEnhanced";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionCompareTwoImages from "Features/baseMapTransforms/components/SectionCompareTwoImages";

// --- Animation ---
const popIn = keyframes`
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
`;

export default function ButtonRunningTransform() {
    const dispatch = useDispatch();

    // data

    const baseMap = useMainBaseMap();
    const enhancingBaseMap = useSelector(
        (s) => s.baseMaps?.enhancingBaseMapIds?.[baseMap?.id]
    );
    const updateBaseMapWithImageEnhanced = useUpdateBaseMapWithImageEnhanced();
    const enhancedResult = useSelector(
        (s) => s.baseMaps?.enhancedImageResults?.[baseMap?.id]
    );

    // state
    const [open, setOpen] = useState(false);

    const enhancingTransformId = enhancingBaseMap?.transformId;

    // helpers
    const ready = enhancedResult?.objectUrl && !enhancingTransformId;
    const isRunning = enhancingBaseMap?.isEnhancing;
    const nothing = !enhancedResult?.objectUrl && !isRunning;

    // handlers
    function handleClick() {
        if (ready) setOpen(true);
    }

    async function handleSaveClick() {
        console.log("handleSaveClick", enhancedResult);
        if (!enhancedResult?.blob) return;
        const fileName = `transformed_${Date.now()}.png`;
        const file = new File([enhancedResult.blob], fileName, { type: "image/png" });
        await updateBaseMapWithImageEnhanced(baseMap.id, file);
        dispatch(clearEnhancedImageResult(baseMap.id));
        setOpen(false);
    }

    // --- Button Config Logic ---
    if (nothing) return null;

    let buttonProps = {};

    if (isRunning) {
        buttonProps = {
            label: "Amélioration en cours...",
            disabled: true,
            startIcon: <CircularProgress size={16} color="inherit" />,
        };
    } else if (ready) {
        buttonProps = {
            label: "Voir le résultat",
            onClick: handleClick,
            // On force une couleur verte/success via sx si ButtonGeneric le permet, sinon via une prop color="success"
            sx: {
                color: "success.main",
                borderColor: "success.main",
                '&:hover': {
                    backgroundColor: "success.light",
                    borderColor: "success.dark",
                }
            },
            startIcon: (
                <CheckCircleIcon
                    color="success"
                    sx={{ animation: `${popIn} 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)` }}
                />
            ),
        };
    }

    // return
    return (
        <>
            <ButtonGeneric
                {...buttonProps}
            />

            {open && (
                <DialogGeneric open={open} onClose={() => setOpen(false)} vh={70}>
                    <BoxFlexVStretch sx={{ height: 1, width: 1, position: "relative" }}>

                        <SectionCompareTwoImages
                            baseMap={baseMap}
                            imageUrl1={enhancedResult.objectUrl}
                            imageUrl2={baseMap.image.imageUrlClient}
                        />

                        <Box sx={{ position: "absolute", bottom: "8px", right: "8px" }}>
                            <ButtonGeneric
                                label="Utiliser l'image transformée"
                                onClick={handleSaveClick}
                                color="secondary"
                                variant="contained"
                            />
                        </Box>
                    </BoxFlexVStretch>
                </DialogGeneric>
            )}
        </>
    );
}