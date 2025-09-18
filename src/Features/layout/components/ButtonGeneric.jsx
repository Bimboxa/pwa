import { Button, Typography } from "@mui/material";

export default function ButtonGeneric({ label, ...props }) {
  return (
    <Button {...props}>
      <Typography variant="body2" noWrap>
        {label}
      </Typography>
    </Button>
  );
}
