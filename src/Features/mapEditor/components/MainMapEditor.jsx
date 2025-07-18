import React, { useRef, useState, useEffect } from "react";

import { useDispatch } from "react-redux";

import { triggerShapesUpdate } from "Features/shapes/shapesSlice";

import useAutoLoadMainBaseMapInMapEditor from "../hooks/useAutoLoadMainBaseMapInMapEditor";
//import useAutoLoadShapesInMapEditor from "../hooks/useAutoLoadShapesInMapEditor";
//import useAutoLoadMarkersInMapEditor from "../hooks/useAutoLoadMarkersInMapEditor";
import useLoadedMainBaseMap from "../hooks/useLoadedMainBaseMap";

import { Box } from "@mui/material";

import MapEditor from "Features/mapEditor/js/MapEditor";
import LayerMapEditor from "./LayerMapEditor";
import PopperEditScale from "./PopperEditScale";
import BlockEntityMarker from "Features/markers/components/BlockEntityMarker";
import SectionNoMap from "./SectionNoMap";

import editor from "App/editor";

export default function MainMapEditor() {
  console.log("[MainMapEditor] render");
  const dispatch = useDispatch();

  // ref

  const containerRef = useRef();
  const mapEditorRef = useRef();

  // data

  const loadedMainBaseMap = useLoadedMainBaseMap();

  // state

  const [containerElExists, setContainerElExists] = useState(false);
  const [mapEditorIsReady, setMapEditorIsReady] = useState(false);

  // helpers

  //const noMap = !Boolean(mapLoaded);
  const noBaseMap = false;

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
      editor.mapEditor = mapEditor;
    }
  }, [containerElExists]);

  // effect - load data in map

  useEffect(() => {
    if (mapEditorIsReady) {
      dispatch(triggerShapesUpdate());
    }
  }, [mapEditorIsReady]);

  // effect - resize observer

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (mapEditorRef.current) {
        mapEditorRef.current.resizeStage();
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  });

  // -- main image
  useAutoLoadMainBaseMapInMapEditor({
    mapEditor: mapEditorRef.current,
    mapEditorIsReady,
  });

  // -- shapes
  //useAutoLoadShapesInMapEditor({
  //  mapEditor: mapEditorRef.current,
  //  mapEditorIsReady,
  //});

  // -- markers
  //useAutoLoadMarkersInMapEditor({
  //  mapEditor: mapEditorRef.current,
  //  mapEditorIsReady,
  //});

  console.log("noBaseMap", noBaseMap);

  if (noBaseMap) {
    //return <SectionNoMap />;
  }

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <PopperEditScale />
      <LayerMapEditor />
      {/*<DraggableFabMarker />*/}
      <BlockEntityMarker top={16} right={16} />
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
