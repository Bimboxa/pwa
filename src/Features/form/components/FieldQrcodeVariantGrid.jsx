import {useState} from "react";
import {createPortal} from "react-dom";

import {
  Box,
  Button,
  ClickAwayListener,
  Grid2,
  IconButton,
  Typography,
} from "@mui/material";
import {
  ArrowForwardIos as Forward,
  ArrowDropDown as Down,
  QrCode,
} from "@mui/icons-material";
import SelectorVariantTree from "Features/tree/components/SelectorVariantTree";
import PanelSelectorEntity from "Features/entities/components/PanelSelectorEntity";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import PanelQrcodeReader from "Features/qrcode/components/PanelQrcodeReader";

export default function FieldQrcodeVariantGrid({
  value,
  onChange,
  valueOptions,
  label,
  size = 8,
  formContainerRef,
}) {
  // string

  const flashS = "Flasher un QR code";

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const valueLabel = value?.length > 0 ? value : flashS;

  // handlers

  function handleScan(qrcode) {
    console.log("[FieldQrcode] SelectionChange", qrcode);
    onChange(qrcode);
    setOpen(false);
  }

  function handleOpenSelector(e) {
    e.stopPropagation();
    setOpen(true);
  }

  function handlePanelClose() {
    setOpen(false);
  }

  return (
    <>
      {open &&
        createPortal(
          <Box
            sx={{
              position: "absolute",
              bgcolor: "white",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <PanelQrcodeReader
              onScan={handleScan}
              onClose={handlePanelClose}
              title={label}
            />
          </Box>,
          formContainerRef.current
        )}

      <Grid2
        container
        sx={{border: (theme) => `1px solid ${theme.palette.divider}`}}
      >
        <Grid2 size={12 - size} sx={{p: 1, bgcolor: "background.default"}}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Grid2>
        <Grid2 size={size} sx={{p: 0, display: "flex"}}>
          <Button
            variant="text"
            fullWidth
            onClick={handleOpenSelector}
            endIcon={<QrCode />}
            sx={{width: 1}}
          >
            <Typography variant="body2" color="text.secondary" sx={{width: 1}}>
              {valueLabel}
            </Typography>
          </Button>
        </Grid2>
      </Grid2>
    </>
  );
}
