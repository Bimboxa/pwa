import {useState, useEffect} from "react";

import useScope from "../hooks/useScope";
import useCreateScope from "../hooks/useCreateScope";
import useUpdateScope from "../hooks/useUpdateScope";

import getListingsToCreateFromAppConfig from "Features/listings/utils/getListingsToCreateFromAppConfig";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function SectionScopeBottomActions({
  forceNew,
  newScopeProjectId,
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

  const {value: scope, loading: loadingScope} = useScope({forceNew});
  const appConfig = useAppConfig();

  const create = useCreateScope();
  const update = useUpdateScope();

  // helpers

  // handlers

  async function handleSave() {
    if (loading) return;

    // const newListings = presetConfig?.listings || [];
    const newListings = getListingsToCreateFromAppConfig(
      appConfig,
      scope?.presetConfig?.key
    );
    console.log("[debug] newListings", newListings);

    setLoading(true);
    if (scope.id) {
      await update(scope, {updateSyncFile: true});
      if (onSaved) onSaved(scope);
    } else {
      const name = scope.name;
      const clientRef = scope.clientRef;
      const projectId = newScopeProjectId;
      const newScope = await create(
        {name, clientRef, projectId, newListings},
        {updateSyncFile: true}
      );
      if (onSaved) onSaved(newScope);
    }
    setLoading(false);
  }
  return <ButtonInPanel label={saveS} onClick={handleSave} loading={loading} />;
}
