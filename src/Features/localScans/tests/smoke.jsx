import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import ThreedEditor from "Features/threedEditor/js/ThreedEditor";
import Gate from "../components/LocalScansGate";
import reducer from "Features/threedEditor/threedEditorSlice";
import applicationStore from "App/store";
import rightPanelReducer from "Features/rightPanel/rightPanelSlice";
import mapEditorReducer from "Features/mapEditor/mapEditorSlice";
import RightPanelContainer from "Features/rightPanel/components/RightPanelContainer";
import theme from "Styles/theme";

// Deliberately uses a synthetic scope, never the user's current project.
const initial = applicationStore.getState();
const seed = {
  ...initial,
  projects: { ...initial.projects, selectedProjectId: "smoke-project" },
  scopes: { ...initial.scopes, selectedScopeId: "smoke-scope" },
  viewers: { ...initial.viewers, selectedViewerKey: "THREED" },
  rightPanel: { ...initial.rightPanel, selectedMenuItemKey: "SCAN_3D" },
  layout: {
    ...initial.layout,
    deviceType: "DESKTOP",
    windowHeight: window.innerHeight,
  },
  appConfig: {
    ...initial.appConfig,
    value: {
      features: { tools: [] },
      entityModelsObject: {
        baseMap: { key: "baseMap", defaultTable: "baseMaps" },
      },
    },
  },
};
// Never dispatch project/scope selection actions: those write shared localStorage.
const store = configureStore({
  middleware: (defaults) => defaults({ serializableCheck: false }),
  reducer: (state = seed, action) => ({
    ...state,
    threedEditor: reducer(state.threedEditor, action),
    rightPanel: rightPanelReducer(state.rightPanel, action),
    mapEditor: mapEditorReducer(state.mapEditor, action),
  }),
});

export function Harness() {
  const host = useRef(null);
  const [editor, setEditor] = useState(null);
  useEffect(() => {
    const instance = new ThreedEditor({
      containerEl: host.current,
      onRendererIsReady: () => {},
    });
    instance.init();
    const cube = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial({ color: 0x00ff00 })
    );
    instance.sceneManager.scene.add(cube);
    instance.renderScene();
    window.smoke = { editor: instance, store, cube };
    setEditor(instance);
    return () => {
      instance.dispose();
      instance.sceneManager._resizeObserver?.disconnect();
      window.removeEventListener("resize", instance.sceneManager.resizeScene);
      cube.geometry.dispose();
      cube.material.dispose();
      instance.sceneManager.renderer.dispose();
      instance.sceneManager.renderer.domElement.remove();
      delete window.smoke;
    };
  }, []);
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ position: "relative", height: "100vh" }}>
          <Box ref={host} sx={{ position: "absolute", inset: 0 }} />
          <Gate editor={editor} />
          <Box
            sx={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              display: "flex",
            }}
          >
            <RightPanelContainer />
          </Box>
        </Box>
      </ThemeProvider>
    </Provider>
  );
}

const root =
  import.meta.hot?.data.root ?? createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<Harness />);
