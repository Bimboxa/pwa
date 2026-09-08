import { useDispatch, useSelector } from "react-redux";

import { pushListingConfigView, popListingConfigView } from "../notesAppSlice";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import useNotesAppConfig from "../hooks/useNotesAppConfig";
import useNotesAppListingConfig from "../hooks/useNotesAppListingConfig";
import useUpdateListingNotesAppConfig from "../hooks/useUpdateListingNotesAppConfig";
import useNotesAppListingRefs from "../hooks/useNotesAppListingRefs";
import usePushNotesAppListingsConfig from "../hooks/usePushNotesAppListingsConfig";

import ViewListingConfigMain from "./ViewListingConfigMain";
import ViewListingConfigFields from "./ViewListingConfigFields";
import ViewListingConfigField from "./ViewListingConfigField";
import ViewListingConfigStateModels from "./ViewListingConfigStateModels";
import ViewListingConfigStateModel from "./ViewListingConfigStateModel";
import ViewListingConfigState from "./ViewListingConfigState";
import ViewListingConfigAutoCode from "./ViewListingConfigAutoCode";

const VIEWS = {
  CONFIG: ViewListingConfigMain,
  FIELDS: ViewListingConfigFields,
  FIELD: ViewListingConfigField,
  STATE_MODELS: ViewListingConfigStateModels,
  STATE_MODEL: ViewListingConfigStateModel,
  STATE: ViewListingConfigState,
  AUTO_CODE: ViewListingConfigAutoCode,
};

// Router of the Krnet listing-configuration sub-views (right panel of a
// business-object listing). The view stack lives in notesAppSlice
// (listingConfigView) so panel remounts keep the open view; the top entry
// picks the rendered view. Hooks are called once here and handed down.
export default function PanelNotesAppListingConfig({ listing }) {
  const dispatch = useDispatch();

  // data

  const notesAppConfig = useNotesAppConfig();
  const appName = notesAppConfig?.name ?? "Krnet";
  const stack = useSelector((s) => s.notesApp.listingConfigView.stack);
  const config = useNotesAppListingConfig(listing);
  const update = useUpdateListingNotesAppConfig(listing);
  const refs = useNotesAppListingRefs(listing);
  const pushConfig = usePushNotesAppListingsConfig();

  // helpers

  const view = stack[stack.length - 1] ?? null;
  const View = view ? VIEWS[view.key] : null;
  const navigate = {
    push: (next) =>
      dispatch(pushListingConfigView({ listingId: listing.id, view: next })),
    pop: () => dispatch(popListingConfigView()),
  };

  // render

  if (!View) return null;

  return (
    <BoxFlexVStretch>
      <View
        key={`${view.key}-${view.fieldId ?? ""}-${view.stateModelId ?? ""}-${view.stateId ?? ""}`}
        listing={listing}
        view={view}
        config={config}
        update={update}
        refs={refs}
        navigate={navigate}
        pushConfig={pushConfig}
        appName={appName}
      />
    </BoxFlexVStretch>
  );
}
