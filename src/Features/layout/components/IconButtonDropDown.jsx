import { IconButton } from "@mui/material";
import { ArrowDropDown as Down, ArrowDropUp as Up } from "@mui/icons-material";

export default function IconButtonDropDown({ open, onOpenChange }) {
  return (
    <IconButton onClick={() => onOpenChange(!open)}>
      {open ? <Up /> : <Down />}
    </IconButton>
  );
}
