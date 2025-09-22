import { useState } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogOnboardingScopeName from "./DialogOnboardingScopeNampe";

export default function ButtonDialogOnboardingSelectScope() {
  // data

  const appConfig = useAppConfig();

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const selectProjectS =
    appConfig?.strings?.project?.select ?? "Choisir un krto";

  // handlers

  function handleClick() {
    setOpen(true);
  }

  return (
    <>
      <ButtonGeneric
        onClick={handleClick}
        label={selectProjectS}
        variant="contained"
        color="secondary"
      />
      {open && (
        <DialogOnboardingScopeName
          open={open}
          onClose={() => setOpen(false)}
          width="300px"
          vh="70"
        />
      )}
    </>
  );
}
