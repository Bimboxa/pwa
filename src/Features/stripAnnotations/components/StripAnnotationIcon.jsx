import { Box } from "@mui/material";
import { Rectangle as Strip } from "@mui/icons-material";

export default function StripAnnotationIcon({
    strokeColor,    // Use this for the secondary (lighter) tone
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
                }}
            >

                <Strip
                    sx={{
                        fontSize: iconSize,
                        color: strokeColor,
                    }}
                />


            </Box>
        </Box>
    );
}
