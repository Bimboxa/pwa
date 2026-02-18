import { Box, List, ListItem, ListItemButton, ListItemText } from "@mui/material";
import { useMemo, useState } from "react";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";

export default function FieldAnnotationPreview({ annotation, padding = 16, imageHeight = 200 }) {
    const [selectedCutIndex, setSelectedCutIndex] = useState(null);

    const { sanitizedAnnotation, bbox } = useMemo(() => {
        const isValidPoint = (p) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y);

        const validMainPoints = annotation?.points?.filter(isValidPoint) || [];
        const validCuts = annotation?.cuts?.map(cut => ({
            ...cut,
            points: cut.points?.filter(isValidPoint) || []
        })).filter(cut => cut.points.length > 0) || [];

        const sanitized = { ...annotation, points: validMainPoints, cuts: validCuts };

        const allValidPoints = [...validMainPoints, ...validCuts.flatMap(cut => cut.points)];

        if (allValidPoints.length === 0) {
            return {
                sanitizedAnnotation: sanitized,
                bbox: { minX: 0, minY: 0, width: 100, height: 100 }
            };
        }

        const minX = Math.min(...allValidPoints.map(p => p.x));
        const minY = Math.min(...allValidPoints.map(p => p.y));
        const maxX = Math.max(...allValidPoints.map(p => p.x));
        const maxY = Math.max(...allValidPoints.map(p => p.y));

        return {
            sanitizedAnnotation: sanitized,
            bbox: {
                minX,
                minY,
                width: Math.max(maxX - minX, 1),
                height: Math.max(maxY - minY, 1)
            }
        };
    }, [annotation]);

    // Calcul du ViewBox : on ajoute le padding aux dimensions totales
    const viewBox = useMemo(() => {
        return `${bbox.minX - padding} ${bbox.minY - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`;
    }, [bbox, padding]);

    return (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
                sx={{
                    width: '100%',
                    height: imageHeight, // Utilise la hauteur passée en prop
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <svg
                    viewBox={viewBox}
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block',
                    }}
                    // "xMidYMid meet" force le SVG à tenir dans le cadre sans être tronqué
                    preserveAspectRatio="xMidYMid meet"
                >
                    <NodeAnnotationStatic
                        annotation={sanitizedAnnotation}
                        selected={false}
                        hovered={false}
                        selectedPartId={selectedCutIndex !== null ? `${sanitizedAnnotation?.id}::CUT::${selectedCutIndex}` : null}
                    />
                </svg>
            </Box>

            {/* Liste des découpes (Cuts) */}
            {annotation?.cuts?.length > 0 && (
                <List dense sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <ListItem disablePadding>
                        <ListItemButton selected={selectedCutIndex === null} onClick={() => setSelectedCutIndex(null)}>
                            <ListItemText primary="Main contour" secondary={`${annotation.points?.length || 0} points`} />
                        </ListItemButton>
                    </ListItem>
                    {annotation.cuts.map((cut, index) => (
                        <ListItem key={index} disablePadding>
                            <ListItemButton selected={selectedCutIndex === index} onClick={() => setSelectedCutIndex(index)}>
                                <ListItemText primary={`Cut ${index + 1}`} secondary={`${cut.points?.length || 0} points`} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );
}