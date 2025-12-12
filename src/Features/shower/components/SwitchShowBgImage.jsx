import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setShowBgImageInMapEditor } from "Features/bgImage/bgImageSlice";

import { Box } from "@mui/material";

import SwitchGeneric from "Features/layout/components/SwitchGeneric";
import IconButtonSettings from "Features/layout/components/IconButtonSettings";
import DialogSelectorBgImage from "Features/mapEditor/components/DialogSelectorBgImage";

export default function SwitchShowBgImage() {
  const dispatch = useDispatch();
  // strings

  const label = "Arrière plan";

  // data

  const checked = useSelector((s) => s.bgImage.showBgImageInMapEditor);

  // state

  const [openSettings, setOpenSettings] = useState(false);
  const [showAction, setShowAction] = useState(false);

  // handler

  function handleChange(value) {
    dispatch(setShowBgImageInMapEditor(value));
  }

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "32px",
        }}
        onMouseEnter={() => setShowAction(true)}
        onMouseLeave={() => setShowAction(false)}
      >
        <SwitchGeneric
          value={checked}
          onChange={handleChange}
          label={label}
        />
        {showAction && (
          <IconButtonSettings onClick={() => setOpenSettings(true)} />
        )}
      </Box>

      <DialogSelectorBgImage
        open={openSettings}
        onClose={() => setOpenSettings(false)}
      />
    </>
  );
}
