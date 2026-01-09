import { Box } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import ToolMergeAnnotations from "./ToolMergeAnnotations";
import ToolResetBaseMapEnhancedImage from "./ToolResetBaseMapEnhancedImage";
import SectionTitleGeneric from "Features/layout/components/SectionTitleGeneric";

import SectionBaseMapTransforms from "Features/baseMapTransforms/components/SectionBaseMapSmartTransforms";

export default function TabBaseMapTools({ baseMap }) {
    return <BoxFlexVStretch>

        <SectionBaseMapTransforms />

        <SectionTitleGeneric title="Autres" sx={{ mt: 2 }} />
        <Box sx={{ width: 1, bgcolor: "white" }}>
            <ToolMergeAnnotations baseMap={baseMap} />
            <ToolResetBaseMapEnhancedImage baseMap={baseMap} />
        </Box>

    </BoxFlexVStretch>
}