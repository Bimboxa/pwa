import {Box, Button, Paper} from "@mui/material";

export default function ButtonBasicMobile({label, onClick, bgcolor, color}) {
  return (
    <Box sx={{width: 1, p: 1}}>
      <Paper sx={{width: 1, bgcolor, color}}>
        <Button fullWidth size="large" color="inherit" onClick={onClick}>
          {label}
        </Button>
      </Paper>
    </Box>
  );
}
