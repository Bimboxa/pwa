import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { setAdminSelectedEntityModelKey } from "../adminEditorSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Button, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";

import useEntityModels from "Features/entityModels/hooks/useEntityModels";
import ListEntityModels from "Features/entityModels/components/ListEntityModels";
import DialogCreateEntityModel from "Features/entityModels/components/DialogCreateEntityModel";

export default function AdminColumnModels() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const searchQuery = useSelector((s) => s.adminEditor.searchQuery);
  const selectedKey = useSelector(
    (s) => s.adminEditor.selectedEntityModelKey
  );
  const models = useEntityModels({ projectId });

  // state

  const [openDialog, setOpenDialog] = useState(false);

  // handlers

  function handleSelect(key) {
    dispatch(setAdminSelectedEntityModelKey(key));
    dispatch(setSelectedMenuItemKey("ADMIN_MODEL"));
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        borderRight: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ p: 1, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle2">
          Entity Models ({models?.length ?? 0})
        </Typography>
      </Box>
      <ListEntityModels
        models={models}
        searchQuery={searchQuery}
        selectedKey={selectedKey}
        onSelect={handleSelect}
      />
      <Box sx={{ p: 1 }}>
        <Button
          size="small"
          startIcon={<Add />}
          onClick={() => setOpenDialog(true)}
          fullWidth
          variant="outlined"
        >
          New
        </Button>
      </Box>
      <DialogCreateEntityModel
        open={openDialog}
        onClose={() => setOpenDialog(false)}
      />
    </Box>
  );
}
