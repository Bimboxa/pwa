import React from "react";

import {useSelector} from "react-redux";

import useInit from "App/hooks/useInit";
import useInitDeviceType from "Features/layout/hooks/useInitDeviceType";
import useInitSelectProject from "Features/projects/hooks/useInitSelectProject";
import useInitSelectScope from "Features/scopes/hooks/useInitSelectScope";
import useInitServicesConfig from "Features/settings/hooks/useInitServicesConfig";

import {Box} from "@mui/material";

import LayoutDesktop from "Features/layout/components/LayoutDesktop";
import LayoutMobile from "Features/layout/components/LayoutMobile";
import {DndContext} from "@dnd-kit/core";

import useDndSensors from "App/hooks/useDndSensors";

export default function MainAppLayout() {
  // init

  useInit();

  useInitServicesConfig();
  useInitDeviceType();

  useInitSelectProject();
  useInitSelectScope();

  // data

  const deviceType = useSelector((s) => s.layout.deviceType);
  const sensors = useDndSensors();

  return (
    <DndContext sensors={sensors}>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
        }}
      >
        {deviceType === "DESKTOP" && <LayoutDesktop />}
        {deviceType === "MOBILE" && <LayoutMobile />}
      </Box>
    </DndContext>
  );
}
