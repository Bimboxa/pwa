import React, {useRef, useState, useEffect} from "react";

import useAutoLoadShapesInThreedEditor from "Features/threedEditor/hooks/useAutoLoadShapesInThreedEditor";

import {Box} from "@mui/material";

import ThreedEditor from "Features/threedEditor/js/ThreedEditor";

export default function MainThreedEditor() {
  // ref

  const containerRef = useRef();
  const threedEditorRef = useRef();

  // state

  const [containerElExists, setContainerElExists] = useState(false);
  const [rendererIsReady, setRendererIsReady] = useState(false); // to trigger the effect load shapes with an existing loadShapes func.

  // helpers

  // const animate = () => {
  //   threedEditorRef.current?.renderScene();
  //   requestAnimationFrame(animate);
  // };

  // effect - init

  useEffect(() => {
    const width = containerRef.current?.getBoundingClientRect().width;
    const height = containerRef.current?.getBoundingClientRect().height;
    if (width && height) {
      setContainerElExists(true);
    }
  }, []);

  useEffect(() => {
    if (containerElExists) {
      const threedEditor = new ThreedEditor({
        containerEl: containerRef.current,
        onRendererIsReady: () => setRendererIsReady(true),
      });
      threedEditor.init();
      threedEditorRef.current = threedEditor;

      threedEditor.renderScene();
      //animate();
    }
  }, [containerElExists]);

  // effect - load shapes
  useAutoLoadShapesInThreedEditor({
    threedEditor: threedEditorRef.current,
    rendererIsReady,
  });

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid grey",
      }}
    >
      <Box sx={{width: 1, height: 1}} ref={containerRef} />
    </Box>
  );
}
