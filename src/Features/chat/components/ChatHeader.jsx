import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { lighten } from "@mui/material";
import { Box, Typography } from "@mui/material";
import theme from "Styles/theme";

export default function ChatHeader() {

    // strings

    const descriptionS = "Demandez ce que vous voulez modifier dans cette liste.";

    // data

    const { value: listing } = useSelectedListing();

    // helper

    const color = listing?.color ?? theme.palette.primary.main;
    const lightColor = lighten(color, 0.2);
    const textColor = theme.palette.getContrastText(lightColor);


    const titleS = `Liste ${listing?.name}`;

    // render

    return (
        <Box
            sx={{
                p: 2,
                bgcolor: lightColor,
                color: textColor,
            }}
        >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>{titleS}</Typography>
            <Typography variant="subtitle1">{descriptionS}</Typography>
        </Box>
    );
}