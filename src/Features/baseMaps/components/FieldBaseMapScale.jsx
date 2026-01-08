import { Box, Typography } from "@mui/material";

export default function FieldBaseMapScale({ baseMap }) {

    // strings

    const noScaleS = "Le fond de plan n'est pas à l'échelle";

    // helper

    const noScale = !Boolean(baseMap?.meterByPx);

    const scaleS = `Echelle: 1 px = ${baseMap?.meterByPx?.toFixed(3)} m`;

    // render

    if (noScale) return <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="error.main">{noScaleS}</Typography>
    </Box>;

    return <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary">{scaleS}</Typography>
    </Box>
}