import { useState, useRef, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import { UnfoldMore } from "@mui/icons-material";

export default function SectionCompareTwoImages({
    imageUrl1,
    imageUrl2,
    variant = "alignToLeft" // "overlap" | "alignToLeft" | "alignToTop"
}) {
    const image1S = "Original";
    const image2S = "Transformée";

    const [sliderPosition, setSliderPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);

    const handleMouseDown = () => setIsDragging(true);
    const handleMouseUp = () => setIsDragging(false);

    const handleMove = (event) => {
        if (!isDragging || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        let x = clientX - rect.left;

        // Bornes de 0 à largeur max
        x = Math.max(0, Math.min(x, rect.width));

        const percentage = (x / rect.width) * 100;
        setSliderPosition(percentage);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handleMove);
            window.addEventListener("mouseup", handleMouseUp);
            window.addEventListener("touchmove", handleMove);
            window.addEventListener("touchend", handleMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("touchmove", handleMove);
            window.removeEventListener("touchend", handleMouseUp);
        };
    }, [isDragging]);

    // Détermination du style de l'image 2 selon le variant
    const getImage2Style = () => {
        const baseStyle = {
            display: "block",
            maxWidth: "none", // Empêche des comportements responsive par défaut indésirables
        };

        switch (variant) {
            case "alignToLeft":
                return {
                    ...baseStyle,
                    height: "100%",
                    width: "auto",
                };
            case "alignToTop":
                return {
                    ...baseStyle,
                    width: "100%",
                    height: "auto",
                };
            case "overlap":
            default:
                return {
                    ...baseStyle,
                    width: "100%",
                    height: "100%",
                    //objectFit: "cover", // Remplit tout l'espace
                    objectFit: "fill", // Remplit tout l'espace
                };
        }
    };

    return (
        <Box
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            sx={{
                position: "relative",
                height: "100%",
                width: "fit-content",
                display: "inline-flex",
                overflow: "hidden", // Coupe ce qui dépasse (important pour alignToLeft/Top si image trop grande)
                cursor: "col-resize",
                userSelect: "none",
                "& img": { pointerEvents: "none" }
            }}
        >
            {/* IMAGE 1 (Reference layer) */}
            <Box
                component="img"
                src={imageUrl1}
                alt="Original"
                sx={{
                    height: "100%",
                    width: "auto",
                    display: "block",
                    border: "1px solid red"
                    //objectFit: "contain" // S'assure que l'img 1 respecte la hauteur
                }}
            />

            {/* WRAPPER DE DECOUPE (Clipping Layer) 
          Ce wrapper prend toujours 100% de la taille du container.
          C'est LUI qu'on coupe. Cela garantit que le trait de coupe suit parfaitement la souris.
      */}
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    // On coupe le wrapper, peu importe la taille de l'image dedans
                    clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                }}
            >
                {/* IMAGE 2 (Overlay) */}
                <Box
                    component="img"
                    src={imageUrl2}
                    alt="Overlay"
                    sx={getImage2Style()}
                />
            </Box>

            {/* SLIDER HANDLE */}
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${sliderPosition}%`,
                    width: "2px",
                    bgcolor: "white",
                    boxShadow: "0 0 5px rgba(0,0,0,0.5)",
                    transform: "translateX(-50%)",
                    pointerEvents: "none",
                }}
            >
                <Box
                    sx={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%) rotate(90deg)",
                        width: 32,
                        height: 32,
                        bgcolor: "white",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                        color: "grey.700"
                    }}
                >
                    <UnfoldMore fontSize="small" />
                </Box>
            </Box>

            {/* LABELS */}
            <Typography sx={{ position: 'absolute', top: 10, left: 10, color: 'white', bgcolor: 'rgba(0,0,0,0.5)', px: 1, borderRadius: 1, fontSize: '0.75rem', pointerEvents: 'none' }}>{image1S}</Typography>
            <Typography sx={{ position: 'absolute', top: 10, right: 10, color: 'white', bgcolor: 'rgba(0,0,0,0.5)', px: 1, borderRadius: 1, fontSize: '0.75rem', pointerEvents: 'none' }}>{image2S}</Typography>

        </Box>
    );
}