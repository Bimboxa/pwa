
import { Box, Typography } from "@mui/material";

import SmartDetectContainer from "./SmartDetectContainer";

export default function SectionSmartDetect({ loupeOnly = false }) {

    // strings

    const title = "Détection auto.";

    // render

    if (loupeOnly) {
        return <SmartDetectContainer />;
    }

    return <SmartDetectContainer />
}