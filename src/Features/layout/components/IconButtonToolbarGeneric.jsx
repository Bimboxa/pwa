import { IconButton, Tooltip, Box } from "@mui/material";

export default function IconButtonToolbarGeneric({
    label,
    size = 24,
    showBorder = false,
    children,
    ...props
}) {
    return (
        <Box sx={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...(showBorder && {
                border: theme => `1px solid ${theme.palette.divider}`,
            }),
            overflow: "hidden",
        }}
        >
            <Tooltip title={label}>
                <IconButton
                    sx={{
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: "8px",
                    }}
                    {...props}
                >
                    {children}
                </IconButton>
            </Tooltip>
        </Box>

    );
}