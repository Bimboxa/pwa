import { useSyncExternalStore } from "react";

import {
  getCommandsRuntime,
  subscribeCommandsRuntime,
} from "../services/commandsRuntimeRegistry";

// `{ ctx, deps }` of the mounted commands toolbar, or null while there is
// none (services/commandsRuntimeRegistry). For the UIs that show / fire a
// command from outside the toolbar.
export default function useCommandsRuntime() {
  return useSyncExternalStore(subscribeCommandsRuntime, getCommandsRuntime);
}
