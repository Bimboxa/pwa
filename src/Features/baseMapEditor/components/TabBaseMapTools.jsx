import { Box } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import ToolMergeAnnotations from "./ToolMergeAnnotations";
import ToolResetBaseMapEnhancedImage from "./ToolResetBaseMapEnhancedImage";
import SectionTitleGeneric from "Features/layout/components/SectionTitleGeneric";
import ListItemButtonBaseMapRotate from "./ListItemButtonBaseMapRotate";
import SectionBaseMapTransforms from "Features/baseMapTransforms/components/SectionBaseMapSmartTransforms";
import ToolCropBaseMapImage from "./ToolCropBaseMapImage";
import ToolRemoveGrayLevel from "./ToolRemoveGrayLevel";
import ToolAddBackground from "./ToolAddBackground";
import ToolConvertToBlackAndWhite from "./ToolConvertToBlackAndWhite";

export default function TabBaseMapTools({ baseMap }) {
    return <BoxFlexVStretch>

        <SectionBaseMapTransforms />

        <SectionTitleGeneric title="Transformations basiques" sx={{ mt: 2 }} />
        <Box sx={{ width: 1, bgcolor: "white" }}>
            <ToolAddBackground baseMap={baseMap} />
            <ToolConvertToBlackAndWhite baseMap={baseMap} />
            <ToolRemoveGrayLevel />
            <ToolCropBaseMapImage baseMap={baseMap} />
            <ListItemButtonBaseMapRotate baseMap={baseMap} />
        </Box>

        <SectionTitleGeneric title="Autres" sx={{ mt: 2 }} />
        <Box sx={{ width: 1, bgcolor: "white" }}>
            <ToolMergeAnnotations baseMap={baseMap} />
            <ToolResetBaseMapEnhancedImage baseMap={baseMap} />
        </Box>

    </BoxFlexVStretch>
}