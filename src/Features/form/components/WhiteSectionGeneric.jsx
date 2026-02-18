import { Box } from "@mui/material"

export default function WhiteSectionGeneric({ children }) {
    return <Box sx={{ p: 0, width: 1 }}>
        <Box sx={{
            p: 1, bgcolor: "white", borderRadius: 1, width: 1,
            border: theme => `1px solid ${theme.palette.divider}`

        }}>
            {children}
        </Box>
    </Box>
}