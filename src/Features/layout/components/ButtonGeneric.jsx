import { forwardRef } from "react";
import { Button, Typography } from "@mui/material";

const ButtonGeneric = forwardRef(({ label, ...props }, ref) => {
  return (
    <Button ref={ref} {...props}>
      <Typography variant="body2" noWrap>
        {label}
      </Typography>
    </Button>
  );
});

ButtonGeneric.displayName = "ButtonGeneric";

export default ButtonGeneric;
