// components/MapTooltip.jsx
import { forwardRef } from 'react';
import { Paper, Typography, Box } from "@mui/material";

const MapTooltip = forwardRef(({ hoveredNode, annotations }, ref) => {

    // strings

    const helperS = "[clic droit] actions"

    // helper - annotations

    const annotation = annotations.find(a => a.id === hoveredNode.nodeId);

    // helper - image
    const imageUrl = annotation?.entity?.image?.imageUrlClient;
    const hasImage = Boolean(imageUrl);

    // helper - description
    const description = annotation?.entity?.text;

    // render

    if (!hoveredNode) return null;
    if (!annotation) return null;



    return (
        <Paper
            ref={ref}
            elevation={4}
            sx={{
                position: "absolute",
                top: 0,
                left: 0,
                // Start hidden or off-screen to avoid (0,0) flash before first move update
                // or just rely on the update loop.
                // Important: pointerEvents: none lets the mouse click "through" the tooltip
                pointerEvents: "none",
                zIndex: 9999,
                padding: 1,
                maxWidth: 200,
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                color: "white",
                borderRadius: 1,
                // Will be moved via transform in JS
                willChange: "transform"
            }}
        >
            {/* Image (only if exists) */}
            {hasImage && (
                <Box
                    component="img"
                    src={imageUrl}
                    alt="Entity image"
                    sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                />
            )}
            <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', color: '#90caf9' }}>
                {annotation.label}
            </Typography>
            {description && (
                <Typography variant="body2">
                    {description}
                </Typography>
            )}
            {/* <Typography variant="caption" sx={{ color: 'grey.500', fontSize: '0.7rem' }}>
                {helperS}
            </Typography> */}
        </Paper>
    );
});

export default MapTooltip;