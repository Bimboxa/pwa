import {useRef} from "react";

import {Popper, ClickAwayListener, Box} from "@mui/material";

export default function PopperBox({anchorPosition, children, open, onClose}) {
  // virtual ref

  function generateBBCR(x, y) {
    return () => ({
      width: 0,
      height: 0,
      top: y,
      right: x,
      bottom: y,
      left: x,
    });
  }
  const virtualElementRef = useRef({getBoundingClientRect: generateBBCR});

  virtualElementRef.current.getBoundingClientRect = generateBBCR(
    anchorPosition?.x,
    anchorPosition?.y
  );

  // handlers

  function handleClose(e) {
    onClose();
  }

  return (
    <>
      {open && (
        <Box>
          <ClickAwayListener onClickAway={handleClose}>
            <Popper
              disablePortal={false}
              open={open}
              onClose={handleClose}
              anchorEl={virtualElementRef.current}
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
              <Box>{children}</Box>
            </Popper>
          </ClickAwayListener>
        </Box>
      )}
    </>
  );
}
