import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import { Box } from "@mui/material"
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch"
import ListAnnotations from "Features/annotations/components/ListAnnotations"


export default function TabBaseMapAnnotations({ baseMap }) {

    // data

    const annotations = useAnnotationsV2({ baseMapAnnotationsOnly: true });

    console.log("annotations", annotations)

    // render

    return <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <Box sx={{ width: 1, bgcolor: "white" }}>
            <ListAnnotations annotations={annotations} />
        </Box>

    </BoxFlexVStretch>
}