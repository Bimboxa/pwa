import { Box, LinearProgress, Typography } from "@mui/material";

export default function ProgressBarLoadingModel({ label, percentage }) {

    return <Box sx={{ display: "flex", width: 1, alignItems: "center" }}>
        <Typography variant="body2">{label}</Typography>
        <Box sx={{ flex: 1, px: 2 }}>
            <LinearProgress variant="determinate" value={percentage ?? 0.2} sx={{ width: 1 }} />
        </Box>
    </Box>
}