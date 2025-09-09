import { configureStore } from "@reduxjs/toolkit";

import appConfigReducer from "Features/appConfig/appConfigSlice";
import authReducer from "Features/auth/authSlice";
import initReducer from "Features/init/initSlice";
import servicesCredentialsReducer from "Features/servicesCredentials/servicesCredentialsSlice";
import settingsReducer from "Features/settings/settingsSlice";
import webrtcReducer from "Features/webrtc/webrtcSlice";
import syncReducer from "Features/sync/syncSlice";
import dashboardReducer from "Features/dashboard/dashboardSlice";
import layoutReducer from "Features/layout/layoutSlice";
import leftPanelReducer from "Features/leftPanel/leftPanelSlice";
import listPanelReducer from "Features/listPanel/listPanelSlice";
import rightPanelReducer from "Features/rightPanel/rightPanelSlice";
import onboardingReducer from "Features/onboarding/onboardingSlice";
import masterProjectsReducer from "Features/masterProjects/masterProjectsSlice";
import projectsReducer from "Features/projects/projectsSlice";
import scopesReducer from "Features/scopes/scopesSlice";
import scopeCreatorReducer from "Features/scopeCreator/scopeCreatorSlice";
import scopeSelectorReducer from "Features/scopeSelector/scopeSelectorSlice";
import baseMapViewsReducer from "Features/baseMapViews/baseMapViewsSlice";
import baseMapsReducer from "Features/baseMaps/baseMapsSlice";
import listingsConfigReducer from "Features/listingsConfig/listingsConfigSlice";
import viewersReducer from "Features/viewers/viewersSlice";
import listingsReducer from "Features/listings/listingsSlice";
import entitiesReducer from "Features/entities/entitiesSlice";
import entityPropsReducer from "Features/entityProps/entityPropsSlice";
import zonesReducer from "Features/zones/zonesSlice";
import relsZoneEntityReducer from "Features/relsZoneEntity/relsZoneEntitySlice";
import locatedEntitiesReducer from "Features/locatedEntities/locatedEntitiesSlice";
import annotationsReducer from "Features/annotations/annotationsSlice";
import shapesReducer from "Features/shapes/shapesSlice";
import markersReducer from "Features/markers/markersSlice";
import threedEditorReducer from "Features/threedEditor/threedEditorSlice";
import mapEditorReducer from "Features/mapEditor/mapEditorSlice";
import reportsReducer from "Features/reports/reportsSlice";
//
import chatReducer from "Features/chat/chatSlice";
import showerReducer from "Features/shower/showerSlice";
//
import gapiReducer from "Features/gapi/gapiSlice";
import dropboxReducer from "Features/dropbox/dropboxSlice";

//import syncTabsMiddleware from "./syncTabsMiddleware";
//import webrtcMiddleware from "Features/webrtc/webrtcMiddleware";

const store = configureStore({
  reducer: {
    appConfig: appConfigReducer,
    auth: authReducer,
    init: initReducer,
    servicesCredentials: servicesCredentialsReducer,
    settings: settingsReducer,
    webrtc: webrtcReducer,
    sync: syncReducer,
    dashboard: dashboardReducer,
    layout: layoutReducer,
    onboarding: onboardingReducer,
    leftPanel: leftPanelReducer,
    listPanel: listPanelReducer,
    rightPanel: rightPanelReducer,
    masterProjects: masterProjectsReducer,
    projects: projectsReducer,
    scopes: scopesReducer,
    scopeCreator: scopeCreatorReducer,
    scopeSelector: scopeSelectorReducer,
    listingsConfig: listingsConfigReducer,
    baseMapViews: baseMapViewsReducer,
    baseMaps: baseMapsReducer,
    listings: listingsReducer,
    entities: entitiesReducer,
    entityProps: entityPropsReducer,
    zones: zonesReducer,
    relsZoneEntity: relsZoneEntityReducer,
    locatedEntities: locatedEntitiesReducer,
    viewers: viewersReducer,
    annotations: annotationsReducer,
    shapes: shapesReducer,
    markers: markersReducer,
    mapEditor: mapEditorReducer,
    threedEditor: threedEditorReducer,
    reports: reportsReducer,
    //
    chat: chatReducer,
    shower: showerReducer,
    //
    gapi: gapiReducer,
    dropbox: dropboxReducer,
  },
  // middleware: (getDefaultMiddleware) =>
  //   getDefaultMiddleware({
  //     serializableCheck: false,
  //   }),
  // middleware: (getDefaultMiddleware) =>
  //   getDefaultMiddleware({
  //     serializableCheck: false,
  //   }).concat(syncTabsMiddleware),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;
