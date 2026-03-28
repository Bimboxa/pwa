import { useState, useRef } from "react";
import { Box, Popper, Paper, Fade, Typography } from "@mui/material";

import getEntityMainImage from "Features/entities/utils/getEntityMainImage";

export default function AnnotationEntityInfoChip({ entity }) {
    // state

    const [anchorEl, setAnchorEl] = useState(null);
    const hoverTimeoutRef = useRef(null);
    const isOpen = Boolean(anchorEl);

    // helpers

    if (!entity) return null;

    const mainImage = getEntityMainImage(entity);
    const label = entity.label || entity.name || entity.num;
    const description = entity.text || entity.description;

    if (!mainImage && !description) return null;

    // handlers

    function handleMouseEnter(event) {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setAnchorEl(event.currentTarget);
    }

    function handleMouseLeave() {
        hoverTimeoutRef.current = setTimeout(() => {
            setAnchorEl(null);
        }, 100);
    }

    function handlePopperEnter() {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    }

    // render

    return (
        <>
            <Box
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    bgcolor: "secondary.main",
                    color: "white",
                    fontSize: 11,
                    fontWeight: "bold",
                    cursor: "pointer",
                    flexShrink: 0,
                }}
            >
                i
            </Box>

            <Popper
                open={isOpen}
                anchorEl={anchorEl}
                placement="left"
                transition
                modifiers={[
                    { name: "offset", options: { offset: [0, 8] } },
                    { name: "preventOverflow", options: { padding: 8 } },
                ]}
                style={{ zIndex: 1500, pointerEvents: "auto" }}
                onMouseEnter={handlePopperEnter}
                onMouseLeave={handleMouseLeave}
            >
                {({ TransitionProps }) => (
                    <Fade {...TransitionProps} timeout={150}>
                        <Paper
                            elevation={6}
                            sx={{
                                p: 1.5,
                                maxWidth: 280,
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                            }}
                        >
                            {mainImage?.url && (
                                <Box
                                    component="img"
                                    src={mainImage.url}
                                    sx={{
                                        width: 1,
                                        maxHeight: 180,
                                        objectFit: "cover",
                                        borderRadius: 1,
                                    }}
                                />
                            )}
                            {label && (
                                <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                                    {label}
                                </Typography>
                            )}
                            {description && (
                                <Typography variant="caption" color="text.secondary">
                                    {description}
                                </Typography>
                            )}
                        </Paper>
                    </Fade>
                )}
            </Popper>
        </>
    );
}
