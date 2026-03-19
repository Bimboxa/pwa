import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { keyframes } from "@emotion/react"; // Ou styled-components selon votre setup

// UI Components
import { Box, CircularProgress, Checkbox, FormControlLabel, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { clearEnhancedImageResult } from "Features/baseMaps/baseMapsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";
import useReplaceVersionImage from "Features/baseMaps/hooks/useReplaceVersionImage";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionCompareTwoImages from "Features/baseMapTransforms/components/SectionCompareTwoImages";

// --- Helpers ---

function getImageSizeFromUrl(url) {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

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
    const createVersion = useCreateBaseMapVersion();
    const replaceVersionImage = useReplaceVersionImage();
    const enhancedResult = useSelector(
        (s) => s.baseMaps?.enhancedImageResults?.[baseMap?.id]
    );

    // state
    const [open, setOpen] = useState(false);
    const [createNewVersion, setCreateNewVersion] = useState(true);

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
        if (!enhancedResult?.objectUrl || !baseMap?.id) return;
        const freshBlob = await fetch(enhancedResult.objectUrl).then((r) => r.blob());
        const fileName = `transformed_${Date.now()}.png`;
        const file = new File([freshBlob], fileName, { type: "image/png" });

        // Compute transform so the AI image overlays the original at the same size
        const originalTransform = baseMap.getActiveVersionTransform();
        const originalImageSize = baseMap.getActiveImageSize();
        const newImageSize = await getImageSizeFromUrl(enhancedResult.objectUrl);
        let transform;
        if (originalImageSize && newImageSize && newImageSize.width > 0) {
            const scale = (originalImageSize.width * (originalTransform.scale || 1)) / newImageSize.width;
            transform = { ...originalTransform, scale };
        }

        if (createNewVersion) {
            await createVersion(baseMap.id, file, { label: "Transformation", transform });
        } else {
            const activeVersion = baseMap.getActiveVersion();
            if (activeVersion) {
                await replaceVersionImage(baseMap.id, activeVersion.id, file, { transform });
            } else {
                await createVersion(baseMap.id, file, { label: "Transformation", transform });
            }
        }
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
                <DialogGeneric open={open} onClose={() => setOpen(false)} vh={90}>
                    <BoxFlexVStretch sx={{ height: 1, width: 1, position: "relative" }}>

                        <SectionCompareTwoImages
                            baseMap={baseMap}
                            imageUrl1={enhancedResult.objectUrl}
                            imageUrl2={baseMap.image.imageUrlClient}
                        />

                        <Box sx={{
                            position: "absolute",
                            bottom: 8,
                            right: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            bgcolor: "white",
                            borderRadius: 1,
                            px: 1.5,
                            py: 0.5,
                            boxShadow: 2,
                        }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={createNewVersion}
                                        onChange={(e) => setCreateNewVersion(e.target.checked)}
                                        size="small"
                                    />
                                }
                                label={
                                    <Typography variant="caption" color="text.primary">
                                        Nouvelle version
                                    </Typography>
                                }
                            />
                            <ButtonGeneric
                                label="Enregistrer"
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