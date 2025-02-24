import React, {useRef, useState, useEffect} from "react";

import {useDispatch} from "react-redux";

import {triggerShapesUpdate} from "Features/shapes/shapesSlice";

import useAutoLoadShapesInMapEditor from "../hooks/useAutoLoadShapesInMapEditor";

import {Box} from "@mui/material";

import MapEditor from "Features/mapEditor/js/MapEditor";

export default function MainMapEditor() {
  const dispatch = useDispatch();

  // ref

  const containerRef = useRef();
  const mapEditorRef = useRef();

  // state

  const [containerElExists, setContainerElExists] = useState(false);
  const [mapEditorIsReady, setMapEditorIsReady] = useState(false);

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
      const bbox = containerRef.current.getBoundingClientRect();
      const mapEditor = new MapEditor({
        container: "container",
        width: bbox.width,
        height: bbox.height,
        onMapEditorIsReady: () => setMapEditorIsReady(true),
      });
      mapEditorRef.current = mapEditor;
    }
  }, [containerElExists]);

  // effect - load shapes

  useEffect(() => {
    if (mapEditorIsReady) {
      dispatch(triggerShapesUpdate());
    }
  }, [mapEditorIsReady]);

  useAutoLoadShapesInMapEditor({
    mapEditor: mapEditorRef.current,
    mapEditorIsReady,
  });

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        id="container"
        ref={containerRef}
        style={{
          boxSizing: "border-box",
          width: "100%",
          height: "100%",
        }}
      />
    </Box>
  );
}
