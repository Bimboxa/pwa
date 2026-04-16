import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Typography, Stack, alpha } from '@mui/material';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';

export default function SectionShortcutHelpers() {
    // data

    const newAnnotationType = useSelector((s) => s.annotations.newAnnotation?.type);
    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

    // helpers

    const isDetectSimilar = enabledDrawingMode === "DETECT_SIMILAR_POLYLINES";

    const SEGMENT_MODES = [
        "CLICK", "POLYLINE_CLICK", "POLYGON_CLICK", "CUT_CLICK", "SPLIT_CLICK",
        "STRIP", "MEASURE", "COMPLETE_ANNOTATION",
    ];
    const canConstrain = SEGMENT_MODES.includes(enabledDrawingMode);

    const NO_SMART_DETECT_MODES = [
        "TECHNICAL_RETURN", "CUT_SEGMENT", "SPLIT_POLYLINE",
        "SPLIT_POLYLINE_CLICK", "COMPLETE_ANNOTATION",
    ];
    const hasSmartDetect = Boolean(enabledDrawingMode) && !NO_SMART_DETECT_MODES.includes(enabledDrawingMode);

    const smartDetectShortcuts = hasSmartDetect
        ? [
            { key: "P", label: "Augmenter le zoom (smart detect)" },
            { key: "M", label: "Diminuer le zoom (smart detect)" },
        ]
        : [];

    const shortcuts = isDetectSimilar
        ? [
            { key: "Clic", label: "Cliquer sur une ligne pour détecter les lignes similaires" },
            { key: "␣", label: "Valider les lignes détectées" },
            { key: "Esc", label: "Quitter le mode dessin" },
            ...smartDetectShortcuts,
        ]
        : [
            {
                key: <KeyboardReturnIcon sx={{ fontSize: '1rem' }} />,
                label: "Terminer le dessin",
            },
            {
                key: "Esc",
                label: "Quitter le mode dessin",
            },
            ...(newAnnotationType === "STRIP"
                ? [{ key: "S", label: "Inverser le sens de la bande" }]
                : []),
            ...(canConstrain
                ? [
                    { key: "0-9", label: "Contraindre la longueur du segment" },
                    { key: "⌫", label: "Effacer la contrainte de longueur" },
                ]
                : []),
            ...smartDetectShortcuts,
        ];

    return (
        <Box
            sx={{
                backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(8px)',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                p: 2,
            }}
        >
            <Typography
                variant="subtitle2"
                sx={{
                    mb: 2,
                    fontWeight: 600,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    fontSize: '0.75rem'
                }}
            >
                Raccourcis Clavier
            </Typography>

            <Stack spacing={1.5}>
                {shortcuts.map((shortcut, index) => (
                    <Box
                        key={index}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 2
                        }}
                    >
                        <Typography variant="body2" sx={{ color: 'text.primary', fontSize: '0.85rem' }}>
                            {shortcut.label}
                        </Typography>

                        <Box
                            component="span"
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '28px',
                                height: '24px',
                                px: 0.5,
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: 'text.disabled',
                                backgroundColor: (theme) => theme.palette.action.hover,
                                borderBottomWidth: '3px',
                                color: 'text.primary',
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                lineHeight: 1,
                            }}
                        >
                            {shortcut.key}
                        </Box>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
}
