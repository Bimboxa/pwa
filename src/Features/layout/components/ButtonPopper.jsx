import {useState, useRef} from "react";

import {Button, Popper, Box, ClickAwayListener} from "@mui/material";
import {ArrowDropDown as Down} from "@mui/icons-material";

export default function ButtonPopper({children, buttonLabel, sx}) {
  // keepOpen : if true, the popper will not close when clicking away

  // ref

  const anchorRef = useRef(null);

  // state

  const [open, setOpen] = useState(false);

  // handlers

  function handleClick() {
    setOpen(true);
  }
  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <Button ref={anchorRef} onClick={handleClick} sx={sx} endIcon={<Down />}>
        {buttonLabel}
      </Button>
      {open && (
        <ClickAwayListener onClickAway={handleClose}>
          <Popper
            disablePortal={false}
            open={open}
            onClose={handleClose}
            anchorEl={anchorRef.current}
            placement="auto"
            modifiers={[
              {
                name: "arrow",
                enabled: true,
              },
              {
                name: "offset",
                options: {
                  offset: [10, 10],
                },
              },
              {
                name: "preventOverflow",
                enabled: true,
                options: {
                  rootBoundary: "viewport",
                  altAxis: true,
                  altBoundary: true,
                  tether: true,
                  padding: 0,
                },
              },
              {
                name: "zIndex",
                enabled: true,
                phase: "write",
              },
            ]}
          >
            {children}
          </Popper>
        </ClickAwayListener>
      )}
    </>
  );
}
