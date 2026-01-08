import { useLiveQuery } from "dexie-react-hooks";

import { Box, Typography } from "@mui/material";

import db from "App/db/db";

export default function FieldBaseMapAnnotations({ baseMap }) {

    // data

    const annotations = useLiveQuery(async () => {
        if (baseMap?.id) {
            return await db.annotations.where({ baseMapId: baseMap.id }).toArray()
        }
    }, [baseMap?.id]);

    // helpers

    const countS = "Nombre d'annotations";

    // render

    return <Box sx={{ p: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">{countS}</Typography>
        <Typography sx={{ fontSize: 12 }} color="text.secondary">{annotations?.length ?? "0"}</Typography>
    </Box>;
}