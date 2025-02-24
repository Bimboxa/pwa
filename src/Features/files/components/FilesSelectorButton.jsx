import {useRef} from "react";

import {
  Button,
  IconButton,
  LinearProgress,
  Box,
  Typography,
  Tooltip,
} from "@mui/material";
import {Add, Image, Computer} from "@mui/icons-material";

export default function FilesSelectorButton({
  onFilesChange,
  multiple = false,
  buttonName = "Choisir un fichier",
  status = "idle",
  variant = "button", // button or icon or toolbar
  buttonVariant = "outlined",
  buttonColor = "primary",
  icon = "add",
  accept = "*",
}) {
  const ref = useRef();

  function handleButtonClick(e) {
    e.stopPropagation();
    ref.current.click();
    console.log("click on ref");
  }
  function handleInputChange(e) {
    let files = [];
    let list = e.currentTarget.files;
    if (list.length > 0) {
      for (let file of list) {
        files.push(file);
      }
    }
    onFilesChange(files);
  }
  return (
    <Box sx={{position: "relative"}}>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{position: "absolute", top: 0, opacity: 0, width: 1}}
        onChange={handleInputChange}
      />
      {variant === "button" && (
        <Button
          icon={
            icon === "add" ? <Add /> : icon === "none" ? <></> : <Computer />
          }
          onClick={handleButtonClick}
          variant={buttonVariant}
          color={buttonColor}
          size="small"
          disableElevation
          sx={{position: "relative"}}
          disabled={status === "loading"}
        >
          <Typography variant="body2">{buttonName}</Typography>
          {status === "loading" && (
            <Box sx={{position: "absolute", bottom: 0, width: "100%"}}>
              <LinearProgress />
            </Box>
          )}
        </Button>
      )}
      {variant === "icon" && (
        <Tooltip title={buttonName}>
          <IconButton onClick={handleButtonClick}>
            {icon === "add" && <Add fontSize="inherit" color="action" />}
            {icon === "image" && <Image fontSize="inherit" color="action" />}
          </IconButton>
        </Tooltip>
      )}
      {variant === "toolbar" && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "common.caplaBlack",
            color: "common.white",
            height: "30px",
            width: "30px",
          }}
        >
          <IconButton onClick={handleButtonClick} color="inherit" size="small">
            <Add fontSize="inherit" color="inherit" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
