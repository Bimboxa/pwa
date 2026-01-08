import { useState } from "react";

import { useDispatch } from "react-redux";

import { ListItemButton, Typography } from "@mui/material";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import { setSelectedBaseMapId } from "Features/baseMaps/baseMapsSlice";

import db from "App/db/db";

export default function ButtonDialogDeleteBaseMap({ baseMap }) {
    const dispatch = useDispatch();

    // strings

    const deleteS = "Supprimer le fond de plan";

    // state

    const [open, setOpen] = useState(false);

    // handlers

    function handleClick() {
        setOpen(true);
    }

    function handleClose() {
        setOpen(false);
    }

    async function confirmDelete() {
        setOpen(false);
        await db.baseMaps.delete(baseMap.id);
        dispatch(setSelectedBaseMapId(null))
    }
    // render

    return <>

        <ListItemButton onClick={handleClick}>
            <Typography variant="body2" color="text.secondary">{deleteS}</Typography>
        </ListItemButton>

        <DialogDeleteRessource open={open} onClose={handleClose} onConfirmAsync={confirmDelete} />

    </>
}