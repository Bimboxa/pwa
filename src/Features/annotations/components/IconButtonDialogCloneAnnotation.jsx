import { useState } from "react";

import IconButton from "@mui/material/IconButton";
import { ContentCopy } from "@mui/icons-material";

import DialogCloneAnnotation from "./DialogCloneAnnotation";
import { Tooltip } from "@mui/material";

export default function IconButtonDialogCloneAnnotation({ annotation }) {

    // strings

    const title = "Cloner l'annotation";

    // state

    const [open, setOpen] = useState(false);

    // handlers

    function handleOpen() {
        setOpen(true);
    }

    function handleClose() {
        setOpen(false);
    }

    return <>
        <Tooltip title={title}>
            <IconButton onClick={handleOpen}>
                <ContentCopy />
            </IconButton>
        </Tooltip>
        <DialogCloneAnnotation open={open} onClose={handleClose} annotation={annotation} />
    </>
}