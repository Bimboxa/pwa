import { getBusinessObjectTypeKeyFromModuleKey } from "./businessObjectModuleKeys";

// Business object type of the selected left-band module, null outside the
// business-objects modules. Derived from the module selection — no dedicated
// redux state.
export default function selectSelectedBusinessObjectTypeKey(state) {
  return getBusinessObjectTypeKeyFromModuleKey(state.viewers.selectedViewerKey);
}
