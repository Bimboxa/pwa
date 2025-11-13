import { useState } from "react";

import useCreateScope from "../hooks/useCreateScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormScope from "./FormScope";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import resolveListingsToCreateFromPresetListings from "Features/listings/services/resolveListingsToCreateFromPresetListings";
import getPresetListingsFromPresetScope from "Features/listings/utils/getPresetListingsFromPresetScope";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function SectionCreateScope({
  projectId,
  onCreated,
  onClose,
  updateSyncFile,
}) {
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
    setLoading(true);

    // 1 - listings

    const presetListings = getPresetListingsFromPresetScope(
      tempScope?.presetConfig,
      appConfig
    );
    const newListings = await resolveListingsToCreateFromPresetListings(
      presetListings,
      appConfig
    );

    // 2 - scope
    const props = {
      ...tempScope,
      projectId,
      newListings,
    };

    // 3 - create

    const newScope = await createScope(props, { updateSyncFile });
    //const newScope = {};
    console.log("newListings", newListings);

    setLoading(false);
    if (onCreated) onCreated({ ...newScope, isNew: true });
  }

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={createScopeS} onClose={onClose} />

      <FormScope scope={tempScope} onChange={setTempScope} />

      <ButtonInPanelV2
        label={createS}
        onClick={handleCreateScope}
        loading={loading}
        variant="contained"
        color="secondary"
      />
    </BoxFlexVStretch>
  );
}
