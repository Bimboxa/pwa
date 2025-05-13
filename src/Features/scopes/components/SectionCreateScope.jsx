import {useState} from "react";

import useCreateScope from "../hooks/useCreateScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormScope from "./FormScope";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import getListingsToCreateFromAppConfig from "Features/listings/utils/getListingsToCreateFromAppConfig";

export default function SectionCreateScope({projectId, onCreated, onClose}) {
  // data

  const createScope = useCreateScope();
  const appConfig = useAppConfig();

  // helpers

  const createScopeS = appConfig.strings.scope.create;
  const createS = "Créer";

  // state

  const [tempScope, setTempScope] = useState({});
  const [loading, setLoading] = useState(false);

  console.log("tempScope", tempScope);

  // handlers

  async function handleCreateScope() {
    // 1 - listings

    const newListings = getListingsToCreateFromAppConfig(
      appConfig,
      tempScope?.presetConfig?.key
    );

    // 2 - scope
    const props = {
      ...tempScope,
      projectId,
      newListings,
    };

    // 3 - create
    setLoading(true);
    const newScope = await createScope(props, {updateSyncFile: true});
    setLoading(false);
    if (onCreated) onCreated({...newScope, isNew: true});
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
