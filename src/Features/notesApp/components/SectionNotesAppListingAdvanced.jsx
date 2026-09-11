import { useDispatch } from "react-redux";

import { pushListingConfigView } from "../notesAppSlice";

import useNotesAppConfig from "../hooks/useNotesAppConfig";
import useNotesAppListingConfig from "../hooks/useNotesAppListingConfig";
import useUpdateListingNotesAppConfig from "../hooks/useUpdateListingNotesAppConfig";
import usePushNotesAppListingsConfig from "../hooks/usePushNotesAppListingsConfig";

import ViewListingConfigMain from "./ViewListingConfigMain";

// "Avancé" tab of the business-object listing properties panel: the root
// CONFIG view of the listing configuration rendered inline (fields, state
// models, codification, object preview... — the Bimboxa listing settings
// that sync with Krnet). The rows opening a sub-view push it onto the
// notesAppSlice stack; the panel then renders PanelNotesAppListingConfig
// in place of the tabs until the stack empties. Hooks are called once here,
// like the sub-view router does.
export default function SectionNotesAppListingAdvanced({ listing }) {
  const dispatch = useDispatch();

  // data

  const notesAppConfig = useNotesAppConfig();
  const appName = notesAppConfig?.name ?? "Krnet";
  const config = useNotesAppListingConfig(listing);
  const update = useUpdateListingNotesAppConfig(listing);
  const pushConfig = usePushNotesAppListingsConfig();

  // helpers

  const navigate = {
    push: (view) =>
      dispatch(pushListingConfigView({ listingId: listing.id, view })),
    // the root has no back
    pop: () => {},
  };

  // render

  return (
    <ViewListingConfigMain
      isRoot
      listing={listing}
      config={config}
      update={update}
      navigate={navigate}
      pushConfig={pushConfig}
      appName={appName}
    />
  );
}
