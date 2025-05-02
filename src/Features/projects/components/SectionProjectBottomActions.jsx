import {useState, useEffect} from "react";

import useProject from "../hooks/useProject";

import useCreateProject from "../hooks/useCreateProject";
import useUpdateProject from "../hooks/useUpdateProject";

import {Box, Button} from "@mui/material";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function SectionProjectBottomActions({forceNew, onSaved}) {
  // strings

  const saveS = "Enregistrer";

  // state

  const [loading, setLoading] = useState(false);
  useEffect(() => {
    return () => setLoading(false);
  }, []);

  // data

  const {value: project, loading: loadingProject} = useProject({forceNew});

  const create = useCreateProject();
  const update = useUpdateProject();

  // handlers

  async function handleSave() {
    if (loading) return;
    setLoading(true);
    if (project.id) {
      await update(project);
    } else {
      await create(project);
    }
    setLoading(false);
    if (onSaved) onSaved(project);
  }
  return (
    <Box sx={{width: 1, p: 1}}>
      <ButtonInPanel onClick={handleSave} label={saveS} />
    </Box>
  );
}
