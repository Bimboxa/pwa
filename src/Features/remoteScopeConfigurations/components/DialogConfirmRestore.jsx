import { useRef, useState } from "react";

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    Typography,
} from "@mui/material";

function formatDate(iso) {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        return d.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

export default function DialogConfirmRestore({ open, onClose, version, onConfirmAsync }) {
    const confirmBtnRef = useRef(null);

    // state

    const [loading, setLoading] = useState(false);

    // strings

    const title = "Restaurer la version";
    const cancelS = "Annuler";
    const confirmS = "Confirmer";

    // helpers

    const author = version?.createdBy?.trigram || "—";
    const date = formatDate(version?.createdAt);

    // handlers

    async function handleConfirm() {
        try {
            setLoading(true);
            await onConfirmAsync();
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            slotProps={{
                transition: {
                    onEntered: () => confirmBtnRef.current?.focus(),
                },
            }}
        >
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Vous allez restaurer l'enregistrement du <strong>{date}</strong> créé par <strong>{author}</strong>.
                </DialogContentText>
                <DialogContentText sx={{ mt: 1 }}>
                    Toutes les données locales du Krto seront remplacées.
                </DialogContentText>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} variant="outlined" disabled={loading}>
                    <Typography variant="body2">{cancelS}</Typography>
                </Button>

                <Button
                    ref={confirmBtnRef}
                    onClick={handleConfirm}
                    color="warning"
                    variant="contained"
                    disabled={loading}
                >
                    <Typography variant="body2">{confirmS}</Typography>
                </Button>
            </DialogActions>
        </Dialog>
    );
}
