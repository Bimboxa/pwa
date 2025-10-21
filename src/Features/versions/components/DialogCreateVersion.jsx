import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { createVersion } from "../versionsSlice";
import { setSelectedVersionId } from "../versionsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { DialogTitle, Box } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import createKrtoVersion from "../services/createKrtoVersionService";

export default function DialogCreateVersion({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const title = "Nouvelle version";

  const labelS = "Libellé";
  const authorS = "Auteur";
  const descriptionS = "Description";

  const createS = "Créer";

  // data

  const appConfig = useAppConfig();
  const orgaCode = appConfig?.orgaCode;
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // state

  const [label, setLabel] = useState("v0");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);

  // helpers

  const disabled = !label || !projectId || !orgaCode;
  console.log("disabled", disabled, projectId, orgaCode);

  // handlers

  async function handleCreate() {
    if (loading) return;
    setLoading(true);
    const krtoVersion = await createKrtoVersion({
      orgaCode,
      projectId,
      label,
      author,
      description,
    });

    console.log("new krtoVersion", krtoVersion);
    dispatch(createVersion(krtoVersion?.metadata));
    dispatch(setSelectedVersionId(krtoVersion?.metadata.id));

    setLoading(false);
    onClose();
  }

  // render

  if (!open) return null;

  return (
    <DialogGeneric open={open} onClose={onClose} width="350px">
      <DialogTitle>{title}</DialogTitle>

      <BoxFlexVStretch>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: "150px",
              minWidth: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <FieldTextV2
              label={labelS}
              value={label}
              onChange={(e) => setLabel(e)}
              options={{ fullWidth: true, showLabel: true }}
            />
          </Box>
          <Box
            sx={{
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              flexGrow: 1,
            }}
          >
            <FieldTextV2
              label={authorS}
              value={author}
              onChange={(e) => setAuthor(e)}
              options={{ fullWidth: true, showLabel: true }}
            />
          </Box>
        </Box>
        <FieldTextV2
          label={descriptionS}
          value={description}
          onChange={(e) => setDescription(e)}
          options={{ multiline: true, fullWidth: true, showLabel: true }}
        />
      </BoxFlexVStretch>

      <ButtonInPanelV2
        label={createS}
        onClick={handleCreate}
        variant="contained"
        loading={loading}
        disabled={disabled}
      />
    </DialogGeneric>
  );
}
