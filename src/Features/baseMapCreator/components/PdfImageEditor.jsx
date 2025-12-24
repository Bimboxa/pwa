import React, { useState, useRef } from "react";

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

export default function PdfImageEditor({ imageUrl, onSave, onCancel }) {
    const dispatch = useDispatch();

    const imgRef = useRef(null);
    const [crop, setCrop] = useState(); // État du cadre visuel
    const [completedCrop, setCompletedCrop] = useState(); // État final validé
    const [imgSize, setImgSize] = useState({ width: 0, height: 0 });


    console.log("completedCrop", completedCrop)

    // Handler appelé quand l'image est chargée dans le DOM
    // Sert à initialiser une zone de crop par défaut centrée
    function onImageLoad(e) {
        const { width, height, naturalWidth, naturalHeight } = e.currentTarget;

        setImgSize({ width: naturalWidth, height: naturalHeight });

        // Ici on initialise un crop libre (pas d'aspect ratio forcé)
        // qui prend 80% de la largeur ou hauteur
        const initialCrop = centerCrop(
            makeAspectCrop(
                {
                    unit: '%',
                    width: 80,
                },
                16 / 9, // Ratio arbitraire pour l'init, mais l'utilisateur sera libre ensuite
                width,
                height,
            ),
            width,
            height,
        );
        setCrop(initialCrop);
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
                flexDirection: "column",
                height: "100%",
                width: "100%",
                bgcolor: "background.paper",
                overflow: "hidden"
            }}
        >



            {/* ZONE CROPPER (Scrollable) */}
            <Box
                sx={{
                    flex: 1,
                    overflow: "auto", // Permet de scroller si l'image est grande
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    bgcolor: "#333",
                    p: 2
                }}
            >
                {/* Le composant ReactCrop enveloppe votre image */}
                <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={handleCommitCrop}
                    // aspect={16 / 9} // Décommentez pour forcer un ratio
                    style={{ maxWidth: '100%' }} // S'assure que le wrapper ne dépasse pas
                >
                    <img
                        ref={imgRef}
                        alt="Crop me"
                        src={imageUrl}
                        style={{ maxWidth: "100%", maxHeight: "70vh" }} // Limite visuelle de l'image
                        onLoad={onImageLoad}
                    />
                </ReactCrop>
            </Box>


        </Paper>
    );
}