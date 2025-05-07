import {useSelector} from "react-redux";

import {useState, useEffect} from "react";

import {Snackbar, Alert} from "@mui/material";

export default function Toaster() {
  // data

  const {message, triggeredAt, isError} = useSelector((s) => s.layout.toaster);

  // state

  const [open, setOpen] = useState(false);

  // init

  useEffect(() => {
    if (message) {
      setOpen(true);
    }
  }, [triggeredAt]);

  // handler

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setOpen(false);
  };
  return (
    <Snackbar
      open={open}
      autoHideDuration={2000}
      onClose={handleClose}
      message={message}
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
    >
      <Alert
        onClose={handleClose}
        severity={isError ? "error" : "success"}
        variant="filled"
        sx={{width: "100%"}}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
