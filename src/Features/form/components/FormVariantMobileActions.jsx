import {Button, Box} from "@mui/material";
import {ArrowBack as Back, ArrowForward as Forward} from "@mui/icons-material";

export default function FormVariantMobileActions({
  onBackClick,
  onForwardClick,
}) {
  return (
    <Box sx={{width: 1}}>
      <Box sx={{display: "flex", width: 1}}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<Back />}
          onClick={onBackClick}
        />
        <Button
          fullWidth
          variant="outlined"
          endIcon={<Forward />}
          onClick={onForwardClick}
        />
      </Box>
    </Box>
  );
}
