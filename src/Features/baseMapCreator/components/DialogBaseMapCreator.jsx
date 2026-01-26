import { useSelector, useDispatch } from "react-redux"

import { setOpenBaseMapCreator } from "../baseMapCreatorSlice"

import DialogGeneric from "Features/layout/components/DialogGeneric"
import PageBaseMapCreator from "./PageBaseMapCreator"

export default function DialogBaseMapCreator() {
    const dispatch = useDispatch();

    // data

    const open = useSelector(s => s.baseMapCreator.open)

    // handlers

    function handleClose() {
        dispatch(setOpenBaseMapCreator(false))
    }

    if (!open) return null;

    // render

    return <DialogGeneric fullscreen={true} open={open} onClose={handleClose} vh={90} vw={90}>
        <PageBaseMapCreator onClose={handleClose} />
    </DialogGeneric>
}