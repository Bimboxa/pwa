import useEnsureSelectedScope, {
  SCOPE_STATUS,
} from "../hooks/useEnsureSelectedScope";

import { Box } from "@mui/material";

import ScreenNoScope from "./ScreenNoScope";

// Renders the modules only once a valid scope is selected: nothing can be
// drawn or created (annotations, listings, ...) outside a scope.
export default function ScopeGate({ children }) {
  // data

  const { status, keepMounted } = useEnsureSelectedScope();

  // render

  if (status === SCOPE_STATUS.READY || keepMounted) return children;

  if (status === SCOPE_STATUS.NO_SCOPE) return <ScreenNoScope />;

  // RESOLVING / NO_PROJECT (useAutoRedirect sends back to the dashboard)
  return <Box sx={{ flex: 1, bgcolor: "background.default" }} />;
}
