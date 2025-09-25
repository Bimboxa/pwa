import { useState } from "react";

import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionSelectProject from "Features/projectSelector/components/SectionSelectProject";

export default function ButtonDialogOnboardingSelectProject() {
  // data

  const appConfig = useAppConfig();
  const userProfile = useSelector((s) => s.auth.userProfile);

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const selectProjectS =
    appConfig?.strings?.project?.select ?? "Choisir un projet";

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
        disabled={!userProfile?.userName}
      />
      {open && (
        <DialogGeneric
          open={open}
          onClose={() => setOpen(false)}
          width="300px"
          vh="70"
        >
          <SectionSelectProject onProjectSelected={() => setOpen(false)} />
        </DialogGeneric>
      )}
    </>
  );
}
