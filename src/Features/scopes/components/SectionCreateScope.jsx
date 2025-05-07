import {useState} from "react";

import useCreateScope from "../hooks/useCreateScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormScope from "./FormScope";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function SectionCreateScope({onCreated, onClose}) {
  // data

  const createScope = useCreateScope();
  const appConfig = useAppConfig();

  // helpers

  const createScopeS = appConfig.strings.scope.create;
  const createS = "Créer";

  // state

  const [tempScope, setTempScope] = useState({});
  const [loading, setLoading] = useState(false);

  // handlers

  async function handleCreateScope() {
    setLoading(true);
    const newScope = await createScope(tempScope);
    setLoading(false);
    if (onCreated) onCreated(newScope);
  }

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={createScopeS} onClose={onClose} />

      <FormScope scope={tempScope} onChange={setTempScope} />

      <ButtonInPanel
        label={createS}
        onClick={handleCreateScope}
        loading={loading}
      />
    </BoxFlexVStretch>
  );
}
