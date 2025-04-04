import {useState} from "react";

import useUpdateProject from "../hooks/useUpdateProject";

import {Box, Button} from "@mui/material";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import FormProject from "./FormProject";

export default function DialogEditProject({open, onClose, project}) {
  // strings

  const saveS = "Enregistrer";

  // state

  const [tempProject, setTempProject] = useState(null);
  const [loading, setLoading] = useState(false);

  // data

  const update = useUpdateProject();

  // handlers

  function handleChange(newProject) {
    setTempProject(newProject);
  }

  async function handleSave() {
    setLoading(true);
    await update(tempProject);
    setLoading(false);
    onClose();
  }

  return (
    <DialogGeneric open={open} onClose={onClose} title={project?.name}>
      <FormProject project={project} onChange={handleChange} />
      <Box sx={{width: 1, display: "flex", justifyContent: "end", mt: 2, p: 1}}>
        <Button
          onClick={handleSave}
          loading={loading}
          variant="contained"
          disabled={!tempProject}
        >
          {saveS}
        </Button>
      </Box>
    </DialogGeneric>
  );
}
