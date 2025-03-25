import {useState, useEffect} from "react";

import useScope from "../hooks/useScope";

import useCreateScope from "../hooks/useCreateScope";
import useUpdateScope from "../hooks/useUpdateScope";

import {Box, Button} from "@mui/material";

export default function SectionScopeBottomActions({forceNew, onSaved}) {
  // strings

  const saveS = "Enregistrer";

  // state

  const [loading, setLoading] = useState(false);
  useEffect(() => {
    return () => setLoading(false);
  }, []);

  // data

  const {value: scope, loading: loadingScope} = useScope({forceNew});

  const create = useCreateScope();
  const update = useUpdateScope();

  // handlers

  async function handleSave() {
    if (loading) return;
    setLoading(true);
    if (scope.id) {
      await update(scope);
    } else {
      await create(scope);
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
