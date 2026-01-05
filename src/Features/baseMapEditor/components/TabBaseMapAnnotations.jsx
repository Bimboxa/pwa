import { useLiveQuery } from "dexie-react-hooks"

import { Box } from "@mui/material"
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch"
import ListAnnotations from "Features/annotations/components/ListAnnotations"

import db from "App/db/db"

export default function TabBaseMapAnnotations({ baseMap }) {

    // data

    const annotations = useLiveQuery(async () => {
        if (baseMap?.id) {
            const mapAnnotations = await db.annotations.where("baseMapId").equals(baseMap.id).toArray()
            return mapAnnotations?.filter((a) => a.isBaseMapAnnotation)
        }

    }, [baseMap?.id]);

    console.log("debug_25_09 [annotations] annotations", annotations);
    // render

    return <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <Box sx={{ width: 1, bgcolor: "white" }}>
            <ListAnnotations annotations={annotations} />
        </Box>

    </BoxFlexVStretch>
}