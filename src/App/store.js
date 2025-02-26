import {configureStore} from "@reduxjs/toolkit";

import settingsReducer from "Features/settings/settingsSlice";
import webrtcReducer from "Features/webrtc/webrtcSlice";
import layoutReducer from "Features/layout/layoutSlice";
import listPanelReducer from "Features/listPanel/listPanelSlice";
import projectsReducer from "Features/projects/projectsSlice";
import viewersReducer from "Features/viewers/viewersSlice";
import mapsReducer from "Features/maps/mapsSlice";
import shapesReducer from "Features/shapes/shapesSlice";
import threedEditorReducer from "Features/threedEditor/threedEditorSlice";
import mapEditorReducer from "Features/mapEditor/mapEditorSlice";
import gapiReducer from "Features/gapi/gapiSlice";

import syncTabsMiddleware from "./syncTabsMiddleware";
import webrtcMiddleware from "Features/webrtc/webrtcMiddleware";

const store = configureStore({
  reducer: {
    settings: settingsReducer,
    webrtc: webrtcReducer,
    layout: layoutReducer,
    listPanel: listPanelReducer,
    projects: projectsReducer,
    viewers: viewersReducer,
    maps: mapsReducer,
    shapes: shapesReducer,
    mapEditor: mapEditorReducer,
    threedEditor: threedEditorReducer,
    gapi: gapiReducer,
  },
  // middleware: (getDefaultMiddleware) =>
  //   getDefaultMiddleware({
  //     serializableCheck: false,
  //   }),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(syncTabsMiddleware),
});

export default store;
