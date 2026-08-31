// components/MapTooltip.jsx
import { forwardRef } from 'react';
import { useLiveQuery } from "dexie-react-hooks";
import { Paper, Typography, Box } from "@mui/material";

import db from "App/db/db";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";

const MapTooltip = forwardRef(({ hoveredNode, annotations, x, y, isSelected }, ref) => {

    // data

    const baseMap = useMainBaseMap();
    const spriteImage = useAnnotationSpriteImage();

    // helper - annotations

    const annotation = annotations.find(a => a.id === hoveredNode?.nodeId);

    // data - detail baseMap (DETAIL annotations link a detail baseMap whose
    // record carries the inline page thumbnail)

    const detailBaseMapId =
        annotation?.type === "DETAIL" ? annotation?.detailBaseMapId : null;
    const detailBaseMap = useLiveQuery(
        async () => (detailBaseMapId ? db.baseMaps.get(detailBaseMapId) : null),
        [detailBaseMapId]
    );

    // helper - template label
    const templateLabel = annotation?.annotationTemplateProps?.label || annotation?.templateLabel;

    // helper - annotation label (entity label when entity-linked, else own label)
    const annotationLabel =
        annotation?.label && annotation.label !== templateLabel
            ? annotation.label
            : null;

    // helper - qties (the annotations prop carries no .qties — parents resolve
    // without withQties — so compute for the single hovered annotation)
    const qties = annotation
        ? getAnnotationQties({ annotation, meterByPx: baseMap?.meterByPx })
        : null;
    const length = qties?.lengthDeveloped != null ? qties.lengthDeveloped : qties?.length;
    const surface = qties?.surfaceDeveloped != null ? qties.surfaceDeveloped : qties?.surface;
    const showLength = Boolean(qties?.enabled) && length > 0;
    const showSurface = Boolean(qties?.enabled) && surface > 0;

    // helper - image
    const entity = annotation?.entity;
    const imageUrl_entity = entity?.image?.imageUrlClient;
    const imageUrl_0 = annotation?.images?.[0]?.imageUrlClient || annotation?.images?.[0]?.imageUrlRemote;
    const imageUrl = imageUrl_entity || imageUrl_0;
    const hasImage = Boolean(imageUrl);

    // helper - folio (DETAIL annotations linked to a PDF page)
    const folioThumbnail =
        annotation?.type === "DETAIL" && !isSelected
            ? detailBaseMap?.image?.thumbnail
            : null;

    // helper - photo (PHOTO pseudo-annotations carry an inline thumbnail)
    const photoThumbnail =
        annotation?.type === "PHOTO" ? annotation?.thumbnail : null;

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
            {/* Photo preview (PHOTO pseudo-annotations, Photos module) */}
            {photoThumbnail && (
                <Box
                    component="img"
                    src={photoThumbnail}
                    alt={annotation.name ?? "Photo"}
                    sx={{
                        width: "100%",
                        objectFit: "cover",
                        borderRadius: 0.5,
                        mb: 0.5,
                    }}
                />
            )}
            {/* Folio page preview (DETAIL annotations, hidden when selected) */}
            {folioThumbnail && (
                <Box
                    component="img"
                    src={folioThumbnail}
                    alt="Folio page"
                    sx={{
                        width: "100%",
                        objectFit: "contain",
                        bgcolor: "white",
                        borderRadius: 0.5,
                        mb: 0.5,
                    }}
                />
            )}
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
            {/* Template (icon + label) */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <AnnotationTemplateIcon
                    template={annotation?.annotationTemplate || annotation}
                    size={16}
                    spriteImage={spriteImage}
                />
                {templateLabel && (
                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#90caf9' }}>
                        {templateLabel}
                    </Typography>
                )}
            </Box>
            {annotationLabel && (
                <Typography variant="caption" sx={{ display: 'block' }}>
                    {annotationLabel}
                </Typography>
            )}
            {/* Qties (length & surface, zero values hidden) */}
            {showLength && (
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                    <Typography variant="caption" sx={{ color: 'grey.500' }}>
                        Longueur
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'warning.main', fontWeight: 500 }}>
                        {length.toFixed(2)} ml
                    </Typography>
                </Box>
            )}
            {showSurface && (
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                    <Typography variant="caption" sx={{ color: 'grey.500' }}>
                        Surface
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'warning.main', fontWeight: 500 }}>
                        {surface.toFixed(2)} m²
                    </Typography>
                </Box>
            )}
        </Paper>
    );
});

export default MapTooltip;
