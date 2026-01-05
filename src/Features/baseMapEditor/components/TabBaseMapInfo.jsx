import {
    Box,
} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import FieldBaseMapAnnotations from "Features/baseMaps/components/FieldBaseMapAnnotations";
import FieldBaseMapShowEnhanced from "Features/baseMaps/components/FieldBaseMapShowEnhanced";

export default function TabBaseMapInfo({ baseMap }) {

    return <BoxFlexVStretch>
        <Box sx={{ bgcolor: "white", width: 1 }}>
            <FieldBaseMapAnnotations baseMap={baseMap} />
            <FieldBaseMapShowEnhanced baseMap={baseMap} />
        </Box>

    </BoxFlexVStretch>
}