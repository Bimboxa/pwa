import { useState } from "react";

import { useSelector, useDispatch } from "react-redux"
import { nanoid } from "@reduxjs/toolkit";

import { addTempBaseMap, updateTempBaseMap } from "../baseMapCreatorSlice";

import { Box } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric"

import pdfToPngAsync from "Features/pdf/utils/pdfToPngAsync";
import FieldOptionKey from "Features/form/components/FieldOptionKey";


export default function ButtonAddTempImage({ pdfFile }) {
    const dispatch = useDispatch();

    // data

    const bboxInRatio = useSelector((state) => state.baseMapCreator.bboxInRatio);
    const pageNumber = useSelector((state) => state.baseMapCreator.pageNumber);

    // helpers - options

    const options = [
        { key: "STANDARD", label: "Standard (72 DPI)", resolution: 72 },
        { key: "MEDIUM", label: "Haute qualité (150 DPI)", resolution: 150 },
        { key: "HIGH", label: "Très Haute qualité (300 DPI)", resolution: 300 },
    ]

    // state

    const [optionKey, setOptionKey] = useState("STANDARD")

    // handlers

    async function handleClick() {
        const id = nanoid();
        const resolution = options.find(o => o.key === optionKey)?.resolution;

        dispatch(addTempBaseMap({ id, name: `Page ${pageNumber}` }));

        const imageFile = await pdfToPngAsync({ pdfFile, page: pageNumber, bboxInRatio, resolution });
        dispatch(updateTempBaseMap({ id, updates: { imageFile } }));

    }
    return <Box sx={{ display: "flex", alignItems: "center" }}>
        <FieldOptionKey
            value={optionKey}
            onChange={setOptionKey}
            valueOptions={options}
        />
        <ButtonGeneric
            label="Ajouter la sélection" onClick={handleClick}
            size="small" variant="contained"
            color="secondary"
        />
    </Box>
}