import { useSyncExternalStore } from "react";

import {
  getBlockDefinitionFromStore,
  subscribeToBlockDefinitions,
} from "../js/blockDefinitionsStore";

// Published definition of a block ({blockId, defId, label, boundsM,
// membersCount}), or null — see blockDefinitionsStore.
export default function useBlockDefinitionInStore(blockId) {
  return useSyncExternalStore(subscribeToBlockDefinitions, () =>
    getBlockDefinitionFromStore(blockId)
  );
}
