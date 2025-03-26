import {useState, useEffect} from "react";

import useProjectPresetScopes from "Features/projects/hooks/useProjectPresetScopes";
import useScope from "../hooks/useScope";
import useCreateScope from "../hooks/useCreateScope";
import useUpdateScope from "../hooks/useUpdateScope";

import {Box, Button} from "@mui/material";

export default function SectionScopeBottomActions({
  forceNew,
  newScopeProjectId,
  presetConfigKey,
  onSaved,
}) {
  // strings

  const saveS = "Enregistrer";

  // state

  const [loading, setLoading] = useState(false);
  useEffect(() => {
    return () => setLoading(false);
  }, []);

  // data
  const presetConfigs = useProjectPresetScopes();
  const {value: scope, loading: loadingScope} = useScope({forceNew});

  const create = useCreateScope();
  const update = useUpdateScope();

  // helpers

  const presetConfig = presetConfigs.find(
    (presetConfig) => presetConfig.key === presetConfigKey
  );
  const newListings = presetConfig?.listings || [];

  // handlers

  async function handleSave() {
    if (loading) return;
    setLoading(true);
    if (scope.id) {
      await update(scope);
    } else {
      const name = scope.name;
      const clientRef = scope.clientRef;
      const projectId = newScopeProjectId;
      await create({name, clientRef, projectId, newListings});
    }
    setLoading(false);
    if (onSaved) onSaved(scope);
  }
  return (
    <Box sx={{width: 1, p: 1}}>
      <Button
        fullWidth
        disabled={loading}
        variant="contained"
        onClick={handleSave}
      >
        {saveS}
      </Button>
    </Box>
  );
}
