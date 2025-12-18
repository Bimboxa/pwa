import { useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setTempAnnotations } from "Features/annotations/annotationsSlice";
import { setTempAnnotationToolbarPosition } from "Features/mapEditor/mapEditorSlice";
import useSaveTempAnnotations from "Features/mapEditor/hooks/useSaveTempAnnotations";

import PopperBox from "Features/layout/components/PopperBox";
import { Box, Button, Typography, IconButton } from "@mui/material";
import { Check as CheckIcon, Close as CloseIcon } from "@mui/icons-material";

export default function PopperSaveTempAnnotations() {
    const dispatch = useDispatch();
    const saveTempAnnotations = useSaveTempAnnotations();
    const saveButtonRef = useRef(null);

    // Position from Redux (calculated in InteractionLayer)
    const anchorPosition = useSelector(
        (s) => s.mapEditor.tempAnnotationToolbarPosition
    );

    const tempAnnotations = useSelector((s) => s.annotations.tempAnnotations);

    // Show if we have data AND a position
    const open =
        Boolean(anchorPosition) &&
        tempAnnotations &&
        tempAnnotations.length > 0;

    useEffect(() => {
        if (open) {
            // setTimeout ensures the element is mounted/visible in the Popper
            setTimeout(() => {
                saveButtonRef.current?.focus();
            }, 50);
        }
    }, [open]);

    const handleClose = () => {
        // Clear on close/cancel
        dispatch(setTempAnnotations([]));
        dispatch(setTempAnnotationToolbarPosition(null));
    };

    const handleConfirm = async () => {
        await saveTempAnnotations();
        dispatch(setTempAnnotationToolbarPosition(null));
        // saveTempAnnotations clears the tempAnnotations at the end, which will close the Popper
    };

    if (!open) return null;

    return (
        <PopperBox
            open={open}
            anchorPosition={anchorPosition}
            onClose={handleClose}
            disableClickAway={true} // Force user to choose
            anchorPlacement="bottomMiddle"
            showGrabHandle={true}
        >
            <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 200 }}>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Sauvegarder ?
                    </Typography>
                    <IconButton size="small" onClick={handleClose}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Typography variant="body2" color="text.secondary">
                    {tempAnnotations.length} élément(s) détecté(s).
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        color="inherit"
                        fullWidth
                        onClick={handleClose}
                    >
                        Ignorer
                    </Button>
                    <Button
                        ref={saveButtonRef}
                        variant="contained"
                        size="small"
                        color="primary"
                        fullWidth
                        onClick={handleConfirm}
                        startIcon={<CheckIcon />}
                    >
                        Sauver
                    </Button>
                </Box>
            </Box>
        </PopperBox>
    );
}

