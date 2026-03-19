
import { Box, Typography } from "@mui/material";

import SmartDetectContainer from "./SmartDetectContainer";

export default function SectionSmartDetect({ loupeOnly = false }) {

    // strings

    const title = "Détection auto.";

    // render

    if (loupeOnly) {
        return <SmartDetectContainer />;
    }

    return <Box sx={{ width: 1, p: 1, bgcolor: 'rgba(0,0,0)' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "grey.500" }}>{title}</Typography>
        <SmartDetectContainer />
    </Box>
}