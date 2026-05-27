import React, { useState, useRef } from "react";
import useMeasure from "react-use-measure";

import { useDispatch } from "react-redux";

import { setBboxInRatio } from "../baseMapCreatorSlice";

import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import { Box, Paper } from "@mui/material";


// --- FONCTION UTILITAIRE : Centrer le crop au chargement ---
function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    )
}

// --- COMPOSANT PRINCIPAL ---

export default function PdfImageEditor({ imageUrl, sourceKey, onSave, onCancel }) {
    const dispatch = useDispatch();

    const imgRef = useRef(null);
    const lastSourceKeyRef = useRef(null);
    const [crop, setCrop] = useState(); // État du cadre visuel
    const [completedCrop, setCompletedCrop] = useState(); // État final validé
    const [aspect, setAspect] = useState(null); // ratio = naturalWidth / naturalHeight
    const [containerRef, bounds] = useMeasure();

    // Compute a stable display size for the <img> from the container bounds
    // and the page aspect ratio (identical across thumbnail / 36 DPI / 72 DPI),
    // so quality upgrades don't change the on-screen size.
    const containerW = Math.max(0, bounds.width - 32);
    const containerH = Math.max(0, bounds.height - 32);
    let displayW = null;
    let displayH = null;
    if (aspect && containerW > 0 && containerH > 0) {
        const containerAspect = containerW / containerH;
        if (aspect > containerAspect) {
            displayW = containerW;
            displayH = containerW / aspect;
        } else {
            displayH = containerH;
            displayW = containerH * aspect;
        }
    }

    // Handler appelé quand l'image est chargée dans le DOM.
    // - aspect: toujours synchronisé avec l'image affichée (pour gérer la
    //   rotation, où la thumbnail fallback non-pivotée a un aspect différent
    //   du rendu pivoté qui arrive ensuite).
    // - crop: ré-initialisé UNIQUEMENT sur changement de source (page/rotation),
    //   pas sur upgrade de qualité de la même source.
    function onImageLoad(e) {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        const newAspect = naturalHeight > 0 ? naturalWidth / naturalHeight : null;

        if (newAspect !== null) {
            setAspect(newAspect);
        }

        if (sourceKey !== lastSourceKeyRef.current) {
            lastSourceKeyRef.current = sourceKey;
            const initialCrop = {
                unit: '%',
                x: 0,
                y: 0,
                width: 100,
                height: 100
            };
            setCrop(initialCrop);
            dispatch(setBboxInRatio({ x1: 0, y1: 0, x2: 1, y2: 1 }));
        }
    }

    function handleCommitCrop(crop, percentCrop) {
        setCompletedCrop(crop)
        const x1 = percentCrop.x / 100;
        const y1 = percentCrop.y / 100;
        const x2 = (percentCrop.x + percentCrop.width) / 100;
        const y2 = (percentCrop.y + percentCrop.height) / 100;
        dispatch(setBboxInRatio({ x1, y1, x2, y2 }))
    }

    const handleReset = () => {
        // On remet un crop par défaut ou on vide
        if (imgRef.current) {
            const { width, height } = imgRef.current;
            setCrop(centerAspectCrop(width, height, 16 / 9));
        }
    }

    if (!imageUrl) return null;

    return (
        <Paper
            elevation={0}
            sx={{
                display: "flex",
                minHeight: 0, // ajout_1
                flex: 1,
                flexDirection: "column",
                height: "100%",
                width: "100%",
                bgcolor: "background.paper",

                //overflow: "hidden" // ajout_1
            }}
        >



            <Box
                ref={containerRef}
                sx={{
                    position: "relative",
                    minHeight: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    bgcolor: "#333",
                    p: 2,
                    height: "100%",
                    overflow: "auto" // Allow scrolling if absolutely necessary, or hidden. Let's try auto to see behavior if it still overflows.
                    //border: "2px solid red"
                }}
            >
                {/* Le composant ReactCrop enveloppe votre image */}
                <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={handleCommitCrop}
                    style={{ maxHeight: "100%" }}
                // aspect={16 / 9} // Décommentez pour forcer un ratio
                >
                    <img
                        ref={imgRef}
                        alt="Crop me"
                        src={imageUrl}
                        style={{
                            // Locked to (containerW × containerH) × aspect — stable
                            // across thumbnail / 36 DPI / 72 DPI upgrades.
                            width: displayW ? `${displayW}px` : "auto",
                            height: displayH ? `${displayH}px` : "auto",
                            maxWidth: containerW > 0 ? `${containerW}px` : "100%",
                            maxHeight: containerH > 0 ? `${containerH}px` : "100%",
                            display: "block",
                            imageRendering: "auto",
                        }}
                        onLoad={onImageLoad}
                    />
                </ReactCrop>
            </Box>


        </Paper >
    );
}
