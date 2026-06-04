import { useSelector, useDispatch } from "react-redux"

import { setOpenBaseMapCreator, clearSourceContainer } from "../baseMapCreatorSlice"

import DialogGeneric from "Features/layout/components/DialogGeneric"
import PageBaseMapCreator from "./PageBaseMapCreator"

export default function DialogBaseMapCreator() {
    const dispatch = useDispatch();

    // data

    const open = useSelector(s => s.baseMapCreator.open)
    const creating = useSelector(s => s.baseMapCreator.creating)

    // handlers

    function handleClose() {
        if (creating) return; // block closing while batch creation is in progress
        dispatch(setOpenBaseMapCreator(false))
        dispatch(clearSourceContainer())
    }

    if (!open) return null;

    // render

    return <DialogGeneric fullscreen={true} open={open} onClose={handleClose} vh={90} vw={90}>
        <PageBaseMapCreator onClose={handleClose} />
    </DialogGeneric>
}