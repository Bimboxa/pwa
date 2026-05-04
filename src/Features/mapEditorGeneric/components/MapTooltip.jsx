// components/MapTooltip.jsx
import { forwardRef } from 'react';
import { Paper, Typography, Box } from "@mui/material";

const MapTooltip = forwardRef(({ hoveredNode, annotations, x, y }, ref) => {

    // helper - annotations

    const annotation = annotations.find(a => a.id === hoveredNode?.nodeId);

    // helper - template label
    const templateLabel = annotation?.annotationTemplateProps?.label || annotation?.templateLabel;

    // helper - entity
    const entity = annotation?.entity;
    const entityLabel = annotation?.label;
    const entityDescription = entity?.description;

    // helper - image
    const imageUrl_entity = entity?.image?.imageUrlClient;
    const imageUrl_0 = annotation?.images?.[0]?.imageUrlClient || annotation?.images?.[0]?.imageUrlRemote;
    const imageUrl = imageUrl_entity || imageUrl_0;
    const hasImage = Boolean(imageUrl);

    // helper - position (controlled mode when x/y are passed)
    const isControlled = typeof x === "number" && typeof y === "number";

    // render

    if (!hoveredNode) return null;
    if (!annotation) return null;
    if (annotation.type === "IMAGE") return null;

    return (
        <Paper
            ref={ref}
            elevation={4}
            sx={{
                position: "absolute",
                top: 0,
                left: 0,
                // In controlled mode the parent passes x/y as props; otherwise
                // the parent updates `transform` imperatively via the ref.
                ...(isControlled && { transform: `translate(${x}px, ${y}px)` }),
                // Important: pointerEvents: none lets the mouse click "through" the tooltip
                pointerEvents: "none",
                zIndex: 9999,
                padding: 1,
                maxWidth: 200,
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                color: "white",
                borderRadius: 1,
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
            <Typography variant="caption" sx={{ display: 'block', color: 'grey.500', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {annotation.type}
            </Typography>
            {templateLabel && (
                <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', color: '#90caf9' }}>
                    {templateLabel}
                </Typography>
            )}
            {entityLabel && (
                <Typography variant="caption" sx={{ display: 'block' }}>
                    {entityLabel}
                </Typography>
            )}
            {entityDescription && (
                <Typography variant="caption" sx={{ display: 'block', color: 'grey.400', mt: 0.5 }}>
                    {entityDescription}
                </Typography>
            )}
        </Paper>
    );
});

export default MapTooltip;