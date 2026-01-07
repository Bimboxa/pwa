import React from 'react';
import { Box, Typography, Stack, alpha } from '@mui/material';
// Import de l'icône pour la touche Entrée
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';

export default function SectionShortcutHelpers() {

    const shortcuts = [
        {
            // On passe directement le composant Icône ici
            key: <KeyboardReturnIcon sx={{ fontSize: '1rem' }} />,
            label: "Terminer le dessin",
        },
        {
            // On passe "Esc" en texte
            key: "Esc",
            label: "Annuler le dessin",
        },
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
                //boxShadow: (theme) => theme.shadows[4],
                //maxWidth: 300,
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

                        {/* Touche Clavier (Keycap Style) */}
                        <Box
                            component="span"
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '28px', // Légèrement plus large pour être confortable
                                height: '24px',
                                px: 0.5,
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: 'text.disabled',
                                backgroundColor: (theme) => theme.palette.action.hover,
                                borderBottomWidth: '3px', // Effet 3D
                                color: 'text.primary',
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                lineHeight: 1,
                            }}
                        >
                            {/* Rendu conditionnel : Si c'est du texte ou un objet (icône) */}
                            {shortcut.key}
                        </Box>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
}