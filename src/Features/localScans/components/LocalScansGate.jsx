/* eslint-disable react/prop-types */
import { Component, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Alert } from "@mui/material";
import {
  selectDisabledToolKeys,
  selectDisabledToolKeysByModule,
} from "Features/scopeConfig/utils/scopeConfigSelectors";

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
        l’outil Scan 3D pour réessayer.
      </Alert>
    ) : (
      this.props.children
    );
  }
}

export default function LocalScansGate({ editor, hidden = false }) {
  const enabled = useSelector(
    (s) =>
      !selectDisabledToolKeys(s).includes("SCAN_3D") &&
      !(
        selectDisabledToolKeysByModule(s)[s.viewers.selectedViewerKey] ?? []
      ).includes("SCAN_3D")
  );
  const selected = useSelector(
    (s) => s.rightPanel.selectedMenuItemKey === "SCAN_3D"
  );
  const [requested, setRequested] = useState(false);
  // Keep a loaded model visible when closing the panel, until the tool is disabled.
  useEffect(() => {
    if (!enabled) setRequested(false);
    else if (selected) setRequested(true);
  }, [enabled, selected]);
  const active = enabled && requested;
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const [Panel, setPanel] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    setError(null);
    import("./LocalScansPanel").then(
      (module) => {
        if (alive) setPanel(() => module.default);
      },
      () => {
        if (alive)
          setError(
            "Impossible de charger le module de scans. Désactivez puis réactivez l’outil Scan 3D pour réessayer."
          );
      }
    );
    return () => {
      alive = false;
    };
  }, [active]);
  if (!active || !editor || !projectId || !scopeId) return null;
  if (error)
    return (
      <Alert
        severity="error"
        sx={{ position: "absolute", bottom: 80, left: 16 }}
      >
        {error}
      </Alert>
    );
  const contextKey = projectId;
  return Panel ? (
    <ScanBoundary key={contextKey}>
      <Panel
        editor={editor}
        projectId={projectId}
        scopeId={scopeId}
        hidden={hidden}
      />
    </ScanBoundary>
  ) : null;
}
