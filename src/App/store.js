import {configureStore} from "@reduxjs/toolkit";

import settingsReducer from "Features/settings/settingsSlice";
import webrtcReducer from "Features/webrtc/webrtcSlice";
import layoutReducer from "Features/layout/layoutSlice";
import projectsReducer from "Features/projects/projectsSlice";
import viewersReducer from "Features/viewers/viewersSlice";
import shapesReducer from "Features/shapes/shapesSlice";
import threedEditorReducer from "Features/threedEditor/threedEditorSlice";
import mapEditorReducer from "Features/mapEditor/mapEditorSlice";

import webrtcMiddleware from "Features/webrtc/webrtcMiddleware";

export default configureStore({
  reducer: {
    settings: settingsReducer,
    webrtc: webrtcReducer,
    layout: layoutReducer,
    projects: projectsReducer,
    viewers: viewersReducer,
    shapes: shapesReducer,
    mapEditor: mapEditorReducer,
    threedEditor: threedEditorReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(webrtcMiddleware),
});
