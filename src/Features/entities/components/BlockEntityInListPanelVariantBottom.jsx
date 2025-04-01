import {Box} from "@mui/material";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function BlockEntityInListPanelVariantBottom({
  label,
  onClick,
  bgcolor,
}) {
  return (
    <Box sx={{width: 1, bgcolor: bgcolor ?? "common.white"}}>
      <ButtonInPanel label={label} onClick={onClick} variant="default" />
    </Box>
  );
}
