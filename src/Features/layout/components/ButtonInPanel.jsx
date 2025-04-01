import {Box, Button, Paper} from "@mui/material";

export default function ButtonInPanel({
  label,
  onClick,
  bgcolor,
  color,
  loading,
}) {
  return (
    <Box sx={{width: 1, p: 1}}>
      <Paper sx={{width: 1, bgcolor, color}}>
        <Button
          fullWidth
          size="large"
          variant="contained"
          onClick={onClick}
          loading={loading}
        >
          {label}
        </Button>
      </Paper>
    </Box>
  );
}
