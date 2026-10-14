import { useDispatch, useSelector } from "react-redux";

import { setImageModeTitleBlock } from "../mapEditorSlice";

import { Box, Typography } from "@mui/material";
import { Edit } from "@mui/icons-material";

import FieldCheck from "Features/form/components/FieldCheck";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

// "Cartouche" block of the capture tool's Cadrage tab: show / hide the title
// block drawn at the bottom-right of the frame and open its edit dialog
// (the same one the double-click on the cartouche opens — the dialog is
// mounted by CaptureTitleBlockOverlay, which knows the cartouche width).
export default function SectionCaptureTitleBlock() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Cartouche";
  const showS = "Afficher le cartouche";
  const editS = "Éditer";

  // data

  const titleBlock = useSelector((s) => s.mapEditor.imageModeTitleBlock);

  // helpers

  const visible = Boolean(titleBlock?.visible);

  // handlers

  function handleToggle(checked) {
    dispatch(setImageModeTitleBlock({ visible: Boolean(checked) }));
  }

  function handleEdit() {
    dispatch(setImageModeTitleBlock({ editing: true }));
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="overline" sx={LABEL_SX}>
        {titleS}
      </Typography>
      <FieldCheck
        value={visible}
        onChange={handleToggle}
        label={showS}
        options={{ type: "switch", showAsInline: true }}
      />
      {visible && (
        <ButtonGeneric
          label={editS}
          variant="outlined"
          size="small"
          startIcon={<Edit />}
          onClick={handleEdit}
        />
      )}
    </Box>
  );
}
