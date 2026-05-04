import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Typography, Stack, alpha } from '@mui/material';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';

export default function SectionShortcutHelpers() {
    // data

    const newAnnotationType = useSelector((s) => s.annotations.newAnnotation?.type);
    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
    const isReassignMode = enabledDrawingMode === "REASSIGN_TEMPLATE";

    // Note: loupe size / constraint-length shortcuts are shown inline inside
    // CardLoupe and SectionSegmentLength respectively — no longer here.
    const shortcuts = [
        ...(isReassignMode
            ? []
            : [{
                key: <KeyboardReturnIcon sx={{ fontSize: '1rem' }} />,
                label: "Terminer le dessin",
            }]),
        {
            key: "Esc",
            label: "Quitter le mode dessin",
        },
        ...(newAnnotationType === "STRIP"
            ? [{ key: "S", label: "Inverser le sens de la bande" }]
            : []),
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
