import { Box } from "@mui/material";

import FieldOptionKey from "./FieldOptionKey";

export default function FieldQty({ value, onChange }) {

    // helper

    const valueOptions = [
        { key: "L", label: "Longueur (L)" },
        { key: "S", label: "Surface (S)" },
        { key: "U", label: "Unité (U)" },
    ]
    return <Box>
        <FieldOptionKey value={value} onChange={onChange} valueOptions={valueOptions} />
    </Box>
}