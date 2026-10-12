import { InputBase } from "@mui/material";
import { alpha } from "@mui/material/styles";

// ---------------------------------------------------------------------------
// InputBaseBand — a dense, always-editable name band: grey at rest so it reads
// as a field, darker on hover, paper background + secondary border on focus.
// Same look as the dossier name band of the Krto recap. Any InputBase prop
// goes through; `sx` is merged on top of the band styling.
// ---------------------------------------------------------------------------

const bandSx = {
  flexGrow: 1,
  minWidth: 0,
  px: 1,
  py: 0.125,
  borderRadius: 1,
  fontSize: "0.875rem",
  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
  border: "1px solid transparent",
  transition: "background-color .15s, border-color .15s",
  "&:hover": {
    bgcolor: (theme) => alpha(theme.palette.text.primary, 0.1),
  },
  "&.Mui-focused": {
    bgcolor: "background.paper",
    borderColor: "secondary.main",
  },
  "& .MuiInputBase-input": { p: 0 },
};

export default function InputBaseBand({ sx, ...props }) {
  // render

  return (
    <InputBase {...props} sx={[bandSx, ...(Array.isArray(sx) ? sx : [sx])]} />
  );
}
