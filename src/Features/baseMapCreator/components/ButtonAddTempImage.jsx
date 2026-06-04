import { useState } from "react";

import { useSelector, useDispatch } from "react-redux"
import { nanoid } from "@reduxjs/toolkit";

import { addTempBaseMap, updateTempBaseMap, setBaseMapName } from "../baseMapCreatorSlice";

import { Box } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric"

import renderTempBaseMapImage from "../utils/renderTempBaseMapImage";
import FieldOptionKey from "Features/form/components/FieldOptionKey";
import FieldTextV2 from "Features/form/components/FieldTextV2";


export default function ButtonAddTempImage({ pdfFile, pdfDocument, blueprintScale }) {
    const dispatch = useDispatch();

    // data

    const bboxInRatio = useSelector((state) => state.baseMapCreator.bboxInRatio);
    const pageNumber = useSelector((state) => state.baseMapCreator.pageNumber);
    const rotate = useSelector((state) => state.baseMapCreator.rotate);
    const name = useSelector((state) => state.baseMapCreator.baseMapName);

    // helpers - options

    const options = [
        { key: "AUTO", label: "Auto (1–5 Mo)", resolution: null },
        { key: "STANDARD", label: "Standard (72 DPI)", resolution: 72 },
        { key: "MEDIUM", label: "Haute qualité (150 DPI)", resolution: 150 },
        { key: "HIGH", label: "Très Haute qualité (300 DPI)", resolution: 300 },
        { key: "VERY_HIGH", label: "Qualité maximale (600 DPI)", resolution: 600 },
    ]

    // state

    const [optionKey, setOptionKey] = useState("AUTO")

    // handlers

    async function handleClick() {
        const id = nanoid();
        const opt = options.find(o => o.key === optionKey);

        dispatch(addTempBaseMap({ id, name: `Page ${pageNumber}` }));

        const { imageFile, meterByPx } = await renderTempBaseMapImage({
            pdfFile,
            pdfDocument,
            page: pageNumber,
            bboxInRatio,
            rotate,
            blueprintScale,
            resolution: opt.resolution, // null => AUTO
        });
        dispatch(updateTempBaseMap({ id, updates: { imageFile, name, meterByPx } }));
    }
    return <Box sx={{ display: "flex", alignItems: "center", width: 1 }}>

        <Box sx={{ flex: 1 }}>
            <FieldTextV2
                value={name}
                onChange={(value) => dispatch(setBaseMapName(value))}
                label="Nom du fond de plan"
                options={{ fullWidth: true, showLabel: true }}
            />
        </Box>
        <ButtonGeneric
            label="Ajouter" onClick={handleClick}
            size="small" variant="contained"
            color="secondary"
        />
        <FieldOptionKey
            value={optionKey}
            onChange={setOptionKey}
            valueOptions={options}
        />
    </Box>
}
