import { forwardRef } from "react";
import { Button, Typography } from "@mui/material";

const ButtonGeneric = forwardRef(({ label, ...props }, ref) => {
  return (
    <Button ref={ref} {...props}>
      <Typography noWrap variant="button">
        {label}
      </Typography>
    </Button>
  );
});

ButtonGeneric.displayName = "ButtonGeneric";

export default ButtonGeneric;
