import {Box, Typography, Button} from "@mui/material";

export default function CardGeneric({
  title,
  description,
  actionLabel,
  onClick,
  disabled,
}) {
  return (
    <Box sx={{p: 1}}>
      <Box
        sx={{
          p: 1,
          borderRadius: "4px",
          border: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography sx={{mb: 1}}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        <Box sx={{display: "flex", justifyContent: "end", width: 1}}>
          <Button
            size="small"
            onClick={onClick}
            variant="outlined"
            disabled={disabled}
          >
            <Typography variant="caption">{actionLabel}</Typography>
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
