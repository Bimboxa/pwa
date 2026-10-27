/* eslint-disable react/prop-types */
import { Component, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Alert } from "@mui/material";

// No database, worker or splat engine is imported until explicitly enabled.
class ScanBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Alert
        severity="error"
        sx={{ position: "absolute", bottom: 80, right: 16 }}
      >
        Le module de scans a rencontré une erreur. Désactivez puis réactivez
        l’option pour réessayer.
      </Alert>
    ) : (
      this.props.children
    );
  }
}

export default function LocalScansGate({
  editor,
  hidden = false,
  rightInset = 0,
  bottomInset = 0,
}) {
  const enabled = useSelector((s) => s.threedEditor.localScansEnabled);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const [Panel, setPanel] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setError(null);
    import("./LocalScansPanel").then(
      (module) => {
        if (alive) setPanel(() => module.default);
      },
      () => {
        if (alive)
          setError(
            "Impossible de charger le module de scans. Désactivez puis réactivez l'option pour réessayer."
          );
      }
    );
    return () => {
      alive = false;
    };
  }, [enabled]);
  if (!enabled || !editor || !projectId || !scopeId) return null;
  if (error)
    return (
      <Alert
        severity="error"
        sx={{ position: "absolute", bottom: 80, left: 16 }}
      >
        {error}
      </Alert>
    );
  const contextKey = JSON.stringify([projectId, scopeId]);
  return Panel ? (
    <ScanBoundary key={contextKey}>
      <Panel
        editor={editor}
        contextKey={contextKey}
        hidden={hidden}
        rightInset={rightInset}
        bottomInset={bottomInset}
      />
    </ScanBoundary>
  ) : null;
}
