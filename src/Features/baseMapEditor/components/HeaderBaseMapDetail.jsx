import { Wallpaper as DetailIcon } from "@mui/icons-material";
import { Box, Typography, Paper } from "@mui/material";

export default function HeaderBaseMapDetail({ baseMap }) {

    const size = 32;

    // strings

    const title = "Fond de plan"

    // 
    return (
        <Box sx={{ p: 1, bgcolor: "white", display: "flex", alignItems: "center", gap: 1 }}>
            <Paper sx={{
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "secondary.main",
                height: size,
                width: size,
                borderRadius: "4px",
                mr: 1
            }}>
                <DetailIcon sx={{ color: "white" }} />
            </Paper>
            <Box>
                <Typography variant="body2" sx={{ fontWeight: "bold" }}>{baseMap?.name}</Typography>
                <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>{title}</Typography>

            </Box>


        </Box >
    );
}