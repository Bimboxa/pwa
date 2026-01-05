import { Box } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import ToolMergeAnnotations from "./ToolMergeAnnotations";
import ToolResetBaseMapEnhancedImage from "./ToolResetBaseMapEnhancedImage";

export default function TabBaseMapTools({ baseMap }) {
    return <BoxFlexVStretch>
        <Box sx={{ width: 1, bgcolor: "white" }}>
            <ToolMergeAnnotations baseMap={baseMap} />
            <ToolResetBaseMapEnhancedImage baseMap={baseMap} />
        </Box>

    </BoxFlexVStretch>
}