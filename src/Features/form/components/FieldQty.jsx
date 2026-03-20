import { Box } from "@mui/material";

import FieldOptionKey from "./FieldOptionKey";

export default function FieldQty({ value, onChange, label, options, drawingShape }) {

    // helper

    const allOptions = [
        { key: "L", label: "Longueur (L)" },
        { key: "S", label: "Surface (S)" },
        { key: "U", label: "Unité (U)" },
    ];

    const valueOptions = drawingShape === "POINT"
        ? allOptions.filter((o) => o.key !== "S")
        : allOptions;
    return <FieldOptionKey value={value} onChange={onChange} valueOptions={valueOptions} options={options} label={label} />

}