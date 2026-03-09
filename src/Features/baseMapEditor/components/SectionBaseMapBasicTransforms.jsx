import { Box } from "@mui/material";

import ToolAddBackground from "./ToolAddBackground";
import ToolConvertToBlackAndWhite from "./ToolConvertToBlackAndWhite";
import ToolRemoveGrayLevel from "./ToolRemoveGrayLevel";
import ToolCropBaseMapImage from "./ToolCropBaseMapImage";
import ListItemButtonBaseMapRotate from "./ListItemButtonBaseMapRotate";

export default function SectionBaseMapBasicTransforms({ baseMap }) {
    return <Box sx={{ width: 1, bgcolor: "white" }}>
        <ToolAddBackground baseMap={baseMap} />
        <ToolConvertToBlackAndWhite baseMap={baseMap} />
        <ToolRemoveGrayLevel />
        <ToolCropBaseMapImage baseMap={baseMap} />
        <ListItemButtonBaseMapRotate baseMap={baseMap} />
    </Box>
}