import { Box } from "@mui/material";
import { PentagonTwoTone as Polygon, Texture } from "@mui/icons-material";

export default function PolygonIcon({
    fillColor,    // Use this for the secondary (lighter) tone
    strokeColor,  // Use this for the primary (outline/darker) tone
    fillOpacity,
    fillType,
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
                {fillType === "HATCHING" ? <Texture sx={{ color: fillColor }} /> : <Polygon
                    sx={{
                        fontSize: iconSize,
                        color: fillColor,
                        // '& path:nth-of-type(2)': {
                        //     fill: strokeColor,
                        //     opacity: 1, // Ensure full color
                        // },
                        // '& path:nth-of-type(1)': {
                        //     fill: fillColor,
                        //     opacity: fillOpacity, // Ensure full color
                        // },
                    }}
                />}

            </Box>
        </Box>
    );
}