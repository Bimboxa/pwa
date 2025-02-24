import {Box} from "@mui/material";

export default function BoxAlignH({children, sx, gap}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        ...(gap && {"&>*:not(:last-child)": {mr: gap}}),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
