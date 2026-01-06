import { Box } from "@mui/material";
import { Circle, Square } from "@mui/icons-material";

export default function PointAnnotationIcon({
    fillColor,    // Use this for the secondary (lighter) tone
    variant,
    size = 24,
}) {
    const iconSize = size * 0.7;

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                borderRadius: "50%",
                bgcolor: "white",
            }}
        >
            <Box
                sx={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    // NOTE: You can set the primary color using the `color` prop below,
                    // but if you want to use the theme's colors (like 'primary' or 'secondary'),
                    // you would set `color` here:
                    // color: 'primary.main', 
                }}
            >
                {variant === "CIRCLE" && <Circle sx={{ color: fillColor, fontSize: iconSize, }} />}
                {variant === "SQUARE" && <Square sx={{ color: fillColor, fontSize: iconSize, }} />}

            </Box>
        </Box>
    );
}