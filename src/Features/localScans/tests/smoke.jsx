import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { Box, CssBaseline } from "@mui/material";
import ThreedEditor from "Features/threedEditor/js/ThreedEditor";
import Gate from "../components/LocalScansGate";
import Section from "../components/SectionLocalScans";
import reducer from "Features/threedEditor/threedEditorSlice";

// Deliberately uses a synthetic scope, never the user's current project.
const store = configureStore({
  reducer: {
    threedEditor: reducer,
    projects: () => ({ selectedProjectId: "smoke-project" }),
    scopes: () => ({ selectedScopeId: "smoke-scope" }),
  },
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
      <CssBaseline />
      <Box sx={{ position: "relative", height: "100vh" }}>
        <Box ref={host} sx={{ position: "absolute", inset: 0 }} />
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            width: 330,
            zIndex: 30,
          }}
        >
          <Section />
        </Box>
        <Gate editor={editor} />
      </Box>
    </Provider>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
