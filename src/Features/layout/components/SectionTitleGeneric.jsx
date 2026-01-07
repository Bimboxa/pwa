
import { Typography } from "@mui/material";

export default function SectionTitleGeneric({ title, sx }) {
    return <Typography variant="body2" color="text.secondary" sx={{ p: 1, ...sx }}>{title}</Typography>
}
