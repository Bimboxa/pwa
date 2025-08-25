import React, { useRef, useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { triggerShapesUpdate } from "Features/shapes/shapesSlice";

//import useAutoLoadMainBaseMapInMapEditor from "../hooks/useAutoLoadMainBaseMapInMapEditor";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
//import useAutoLoadShapesInMapEditor from "../hooks/useAutoLoadShapesInMapEditor";
import useAutoLoadMarkersInMapEditor from "../hooks/useAutoLoadMarkersInMapEditor";
import useLoadedMainBaseMap from "../hooks/useLoadedMainBaseMap";
import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";

import { Box } from "@mui/material";

import MapEditor from "Features/mapEditor/js/MapEditor";
import LayerMapEditor from "./LayerMapEditor";
import LayerScreenCursor from "./LayerScreenCursor";
import PopperEditScale from "./PopperEditScale";
import BlockEntityMarker from "Features/markers/components/BlockEntityMarker";
import SectionNoMap from "./SectionNoMap";

import editor from "App/editor";
import useAutoSelectBaseMapViewInEditor from "Features/baseMapViews/hooks/useAutoSelectBaseMapViewInEditor";
import useAutoSetMapEditorConfig from "../hooks/useAutoSetMapEditorConfig";
import useAutoUpdateMarkersManager from "Features/markers/hooks/useAutoUpdateMarkersManager";
import useAutoLoadBaseMapViewInMapEditor from "../hooks/useAutoLoadBaseMapViewInMapEditor";

export default function MainMapEditor() {
  console.log("[MainMapEditor] render");
  const dispatch = useDispatch();

  // ref

  const containerRef = useRef();
  const mapEditorRef = useRef();

  // auto

  //useAutoSelectMainBaseMap();
  useAutoSelectBaseMapViewInEditor();

  // data

  const loadedMainBaseMap = useLoadedMainBaseMap();
  const { value: baseMaps } = useBaseMaps();
  const showLayerScreenCursor = useSelector(
    (s) => s.mapEditor.showLayerScreenCursor
  );

  // state

  const [containerElExists, setContainerElExists] = useState(false);
  const [mapEditorIsReady, setMapEditorIsReady] = useState(false);

  // helpers

  const noBaseMap = !baseMaps?.length > 0;
  //const noBaseMap = false;

  // effect - init

  useEffect(() => {
    if (containerRef.current) {
      const width = containerRef.current?.getBoundingClientRect().width;
      const height = containerRef.current?.getBoundingClientRect().height;
      if (width && height) {
        setContainerElExists(true);
      }
    }
  }, [containerRef.current]);

  useEffect(() => {
    console.log("CREATE MAP EDITOR", containerElExists);
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
  }, []);

  // -- main
  useAutoSetMapEditorConfig();
  useAutoUpdateMarkersManager();

  // -- baseMapView
  useAutoLoadBaseMapViewInMapEditor({
    mapEditor: mapEditorRef.current,
    mapEditorIsReady,
  });

  // -- main image
  //useAutoLoadMainBaseMapInMapEditor({
  //  mapEditor: mapEditorRef.current,
  //  mapEditorIsReady,
  //});

  // -- shapes
  //useAutoLoadShapesInMapEditor({
  //  mapEditor: mapEditorRef.current,
  //  mapEditorIsReady,
  //});

  //--markers;
  // useAutoLoadMarkersInMapEditor({
  //   mapEditor: mapEditorRef.current,
  //   mapEditorIsReady,
  // });

  console.log("noBaseMap", noBaseMap);

  if (noBaseMap) {
    return <SectionNoMap />;
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
      {showLayerScreenCursor && (
        <LayerScreenCursor containerEl={containerRef.current} />
      )}
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
