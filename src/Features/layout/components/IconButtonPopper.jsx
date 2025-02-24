import {useState, useRef} from "react";

import {IconButton, Popper, Box, ClickAwayListener} from "@mui/material";

export default function IconButtonPopper({children, icon, keepOpen}) {
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
    if (!keepOpen) setOpen(false);
  }

  return (
    <>
      <IconButton ref={anchorRef} onClick={handleClick}>
        {icon}
      </IconButton>
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
            ]}
          >
            {children}
          </Popper>
        </ClickAwayListener>
      )}
    </>
  );
}
