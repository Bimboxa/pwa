import {Palette} from "@mui/icons-material";
import IconButtonMenuContainer from "Features/layout/components/IconButtonMenuContainer";
import {CompactPicker} from "react-color";

export default function FieldColorVariantToolbar({value, onChange}) {
  // handlers

  function handleColorChange(color) {
    console.log("color", color.hex);
    onChange(color.hex);
  }

  return (
    <IconButtonMenuContainer
      icon={<Palette sx={{color: "white"}} />}
      sx={{bgcolor: value}}
    >
      <CompactPicker onChange={handleColorChange} color={value} />
    </IconButtonMenuContainer>
  );
}
