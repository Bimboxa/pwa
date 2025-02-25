import {useState} from "react";

import {AutoAwesome} from "@mui/icons-material";
import {IconButton, Tooltip} from "@mui/material";

import DialogAutoSegmentation from "Features/autoSegmentation/components/DialogAutoSegmentation";

export default function ButtonAutoSegmentation() {
  // strings

  const title = "Segmentation automatique";

  // state

  const [open, setOpen] = useState(false);

  // handler

  function handleClick() {
    setOpen(true);
  }

  return (
    <>
      <Tooltip title={title}>
        <IconButton onClick={handleClick} color="inherit">
          <AutoAwesome />
        </IconButton>
      </Tooltip>
      <DialogAutoSegmentation open={open} onClose={() => setOpen(false)} />
    </>
  );
}
