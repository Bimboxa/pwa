import {useState} from "react";

import {IconButton, Menu, Box} from "@mui/material";
import {Upload} from "@mui/icons-material";

import ContainerFilesSelector from "./ContainerFilesSelector";

export default function IconButtonUploadFile({onChange}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // handler
  function handleClick(event) {
    console.log("click");
    setAnchorEl(event.currentTarget);
  }
  function handleClose() {
    setAnchorEl(null);
  }
  function handleFileSelected(file) {
    onChange(file);
    handleClose();
  }

  return (
    <Box>
      <IconButton onClick={handleClick}>
        <Upload />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <ContainerFilesSelector onFileSelected={handleFileSelected} />
      </Menu>
    </Box>
  );
}
