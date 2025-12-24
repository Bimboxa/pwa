import { useSelector, useDispatch } from "react-redux"
import { nanoid } from "@reduxjs/toolkit";

import { addTempBaseMap, updateTempBaseMap } from "../baseMapCreatorSlice";

import ButtonGeneric from "Features/layout/components/ButtonGeneric"

import pdfToPngAsync from "Features/pdf/utils/pdfToPngAsync";

export default function ButtonAddTempImage({ pdfFile }) {
    const dispatch = useDispatch();

    // data

    const bboxInRatio = useSelector((state) => state.baseMapCreator.bboxInRatio);
    const pageNumber = useSelector((state) => state.baseMapCreator.pageNumber);

    // handlers

    async function handleClick() {
        const id = nanoid();

        dispatch(addTempBaseMap({ id, name: `Page ${pageNumber}` }));

        const imageFile = await pdfToPngAsync({ pdfFile, page: pageNumber, bboxInRatio });
        dispatch(updateTempBaseMap({ id, updates: { imageFile } }));

    }
    return <ButtonGeneric
        label="Ajouter la sélection" onClick={handleClick}
        size="small" variant="contained"
        color="secondary"
    />
}