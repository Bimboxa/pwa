import React, { useState, useRef } from "react";
import useMeasure from "react-use-measure";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import { Box, Paper, Button, Stack } from "@mui/material";

export default function ImageCropper({ imageUrl, onCroppedImage, onCancel }) {
    const imgRef = useRef(null);
    const [crop, setCrop] = useState(); // État visuel (en % ou px selon l'usage)
    const [completedCrop, setCompletedCrop] = useState(); // État final (en px par rapport à l'image affichée)
    const [containerRef, bounds] = useMeasure();

    // --- 1. Initialisation au chargement de l'image ---
    function onImageLoad(e) {
        // On initialise un crop qui prend 100% de l'image par défaut
        const initialCrop = {
            unit: '%',
            x: 0,
            y: 0,
            width: 100,
            height: 100
        };
        setCrop(initialCrop);
        // On définit aussi le completedCrop immédiatement pour éviter un bug si l'user ne touche à rien
        // Note: ReactCrop le fera souvent tout seul, mais c'est une sécurité
    }

    // --- 2. Logique de génération du fichier (Crop) ---
    const getCroppedImg = async (image, crop, fileName) => {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        // Calcul de la taille réelle du canvas (résolution native)
        canvas.width = crop.width * scaleX;
        canvas.height = crop.height * scaleY;

        const ctx = canvas.getContext('2d');

        // Dessiner l'image découpée sur le canvas
        // Syntaxe: drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
        ctx.drawImage(
            image,
            crop.x * scaleX,      // Source X (native)
            crop.y * scaleY,      // Source Y (native)
            crop.width * scaleX,  // Source Width (native)
            crop.height * scaleY, // Source Height (native)
            0,                    // Destination X
            0,                    // Destination Y
            crop.width * scaleX,  // Destination Width
            crop.height * scaleY  // Destination Height
        );

        // Transformer le canvas en Blob puis en File
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    console.error('Canvas is empty');
                    return reject(new Error('Canvas is empty'));
                }
                // On crée un objet File à partir du Blob
                const file = new File([blob], fileName, { type: 'image/jpeg' });
                resolve(file);
            }, 'image/jpeg', 1); // 1 = Qualité maximale (100%)
        });
    };

    // --- 3. Handler du bouton "Enregistrer" ---
    const handleSave = async () => {
        if (!completedCrop || !imgRef.current) {
            // Si pas de crop défini, on renvoie l'image entière ou on ne fait rien
            return;
        }

        try {
            const file = await getCroppedImg(
                imgRef.current,
                completedCrop,
                "cropped-image.jpg" // Nom par défaut
            );

            // Callback vers le parent avec le fichier
            if (onCroppedImage) {
                onCroppedImage(file);
            }
        } catch (e) {
            console.error("Erreur lors du crop", e);
        }
    };

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
            {/* Zone de l'image */}
            <Box
                ref={containerRef}
                sx={{
                    position: "relative",
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    bgcolor: "#333", // Fond foncé pour mieux voir l'image
                    p: 2,
                }}
            >
                <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    style={{ maxHeight: "100%" }}
                >
                    <img
                        ref={imgRef}
                        alt="Crop me"
                        src={imageUrl}
                        onLoad={onImageLoad}
                        style={{
                            // Adaptation responsive : on s'assure que l'image rentre dans le container
                            maxWidth: (bounds.width - 32) > 0 ? (bounds.width - 32) : "100%",
                            maxHeight: (bounds.height - 32) > 0 ? (bounds.height - 32) : "100%",
                            objectFit: "contain",
                            display: "block"
                        }}
                    />
                </ReactCrop>
            </Box>

            {/* Barre d'actions */}
            <Paper
                elevation={4}
                sx={{
                    p: 2,
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 2,
                    zIndex: 10
                }}
            >
                <Button
                    variant="outlined"
                    color="inherit"
                    onClick={onCancel}
                >
                    Annuler
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSave}
                    disabled={!completedCrop?.width || !completedCrop?.height}
                >
                    Enregistrer
                </Button>
            </Paper>
        </Paper>
    );
}