import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Add } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function ButtonCreateScope() {
  // data

  const appConfig = useAppConfig();

  // helpers

  const createS = appConfig?.scope?.createS ?? "Créer un dossier";

  // handlers

  function handleCreate() {}

  // render

  return (
    <ButtonGeneric
      startIcon={<Add />}
      variant="contained"
      color="secondary"
      label={createS}
      onClick={handleCreate}
    />
  );
}
