import { useState } from "react";

import { useSelector, useDispatch } from "react-redux"
import { nanoid } from "@reduxjs/toolkit";

import { addTempBaseMap, updateTempBaseMap } from "../baseMapCreatorSlice";

import { Box } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric"

import pdfToPngAsync from "Features/pdf/utils/pdfToPngAsync";
import findAutoDpi from "Features/pdf/utils/findAutoDpi";
import FieldOptionKey from "Features/form/components/FieldOptionKey";
import FieldTextV2 from "Features/form/components/FieldTextV2";


export default function ButtonAddTempImage({ pdfFile, pdfDocument, blueprintScale }) {
    const dispatch = useDispatch();

    // data

    const bboxInRatio = useSelector((state) => state.baseMapCreator.bboxInRatio);
    const pageNumber = useSelector((state) => state.baseMapCreator.pageNumber);
    const rotate = useSelector((state) => state.baseMapCreator.rotate);

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
    const [name, setName] = useState("")

    // handlers

    async function handleClick() {
        const id = nanoid();
        const opt = options.find(o => o.key === optionKey);

        dispatch(addTempBaseMap({ id, name: `Page ${pageNumber}` }));

        let imageFile, meterByPx;
        if (opt.key === "AUTO") {
            const { dpi, probeBlob } = await findAutoDpi({ pdfFile, pdfDocument, page: pageNumber, bboxInRatio, rotate });
            if (probeBlob) {
                const pdfFileName = (pdfFile?.name ?? "page").replace(".pdf", "");
                const fileName = `${pdfFileName}_page${pageNumber}_auto.png`;
                imageFile = new File([probeBlob], fileName, { type: "image/png" });
                meterByPx = blueprintScale ? (0.0254 / dpi) * Number(blueprintScale) : null;
            } else {
                ({ imageFile, meterByPx } = await pdfToPngAsync({ pdfFile, pdfDocument, page: pageNumber, bboxInRatio, resolution: dpi, rotate, blueprintScale }));
            }
        } else {
            ({ imageFile, meterByPx } = await pdfToPngAsync({ pdfFile, pdfDocument, page: pageNumber, bboxInRatio, resolution: opt.resolution, rotate, blueprintScale }));
        }
        dispatch(updateTempBaseMap({ id, updates: { imageFile, name, meterByPx } }));
    }
    return <Box sx={{ display: "flex", alignItems: "center", width: 1 }}>

        <Box sx={{ flex: 1 }}>
            <FieldTextV2
                value={name}
                onChange={setName}
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
