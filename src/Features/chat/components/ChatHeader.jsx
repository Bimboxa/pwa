import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { lighten } from "@mui/material";
import { Box, Typography } from "@mui/material";
import theme from "Styles/theme";

export default function ChatHeader() {

    // strings

    const descriptionS =
        "Demandez un dessin, une liste, des modèles… ou déposez un PDF à vectoriser.";

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