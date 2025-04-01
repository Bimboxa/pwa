import {Button, Box, IconButton} from "@mui/material";
import {ArrowBack as Back, ArrowForward as Forward} from "@mui/icons-material";

export default function FormVariantMobileActions({
  onBackClick,
  onForwardClick,
  onShowOverviewClick,
}) {
  // strings

  const showS = "Voir le récap.";

  return (
    <Box sx={{width: 1}}>
      <Box
        sx={{
          display: "flex",
          width: 1,
          p: 1,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            onBackClick();
          }}
        >
          <Back />
        </IconButton>

        <Button onClick={onShowOverviewClick}>{showS}</Button>

        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            onForwardClick();
          }}
        >
          <Forward />
        </IconButton>
      </Box>
    </Box>
  );
}
