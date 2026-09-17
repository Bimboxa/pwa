import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box, Typography } from "@mui/material";
import theme from "Styles/theme";

export default function ChatHeader() {

    // strings

    const descriptionS =
        "Demandez un dessin, une liste, des modèles… ou déposez un PDF à vectoriser.";

    // data

    const { value: listing } = useSelectedListing();

    // helper

    const color = listing?.color ?? theme.palette.secondary.main;

    const titleS = `Liste ${listing?.name}`;

    // render — dark, like the panel; the listing colour stays as an accent.

    return (
        <Box
            sx={{
                p: 2,
                bgcolor: "background.default",
                color: "text.primary",
                borderBottom: "1px solid",
                borderColor: "divider",
                borderLeft: `3px solid ${color}`,
            }}
        >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>{titleS}</Typography>
            <Typography variant="body2" color="text.secondary">{descriptionS}</Typography>
        </Box>
    );
}
