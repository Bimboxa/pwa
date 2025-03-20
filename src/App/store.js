import {configureStore} from "@reduxjs/toolkit";

import servicesCredentialsReducer from "Features/servicesCredentials/servicesCredentialsSlice";
import settingsReducer from "Features/settings/settingsSlice";
import webrtcReducer from "Features/webrtc/webrtcSlice";
import layoutReducer from "Features/layout/layoutSlice";
import listPanelReducer from "Features/listPanel/listPanelSlice";
import projectsReducer from "Features/projects/projectsSlice";
import scopesReducer from "Features/scopes/scopesSlice";
import viewersReducer from "Features/viewers/viewersSlice";
import listingsReducer from "Features/listings/listingsSlice";
import locatedEntitiesReducer from "Features/locatedEntities/locatedEntitiesSlice";
import mapsReducer from "Features/maps/mapsSlice";
import shapesReducer from "Features/shapes/shapesSlice";
import markersReducer from "Features/markers/markersSlice";
import threedEditorReducer from "Features/threedEditor/threedEditorSlice";
import mapEditorReducer from "Features/mapEditor/mapEditorSlice";
//
import gapiReducer from "Features/gapi/gapiSlice";
import dropboxReducer from "Features/dropbox/dropboxSlice";

import syncTabsMiddleware from "./syncTabsMiddleware";
import webrtcMiddleware from "Features/webrtc/webrtcMiddleware";

const store = configureStore({
  reducer: {
    servicesCredentials: servicesCredentialsReducer,
    settings: settingsReducer,
    webrtc: webrtcReducer,
    layout: layoutReducer,
    listPanel: listPanelReducer,
    projects: projectsReducer,
    scopes: scopesReducer,
    listings: listingsReducer,
    locatedEntities: locatedEntitiesReducer,
    viewers: viewersReducer,
    maps: mapsReducer,
    shapes: shapesReducer,
    markers: markersReducer,
    mapEditor: mapEditorReducer,
    threedEditor: threedEditorReducer,
    //
    gapi: gapiReducer,
    dropbox: dropboxReducer,
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
