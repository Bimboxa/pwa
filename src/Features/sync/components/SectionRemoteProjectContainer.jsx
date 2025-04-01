import {useSelector} from "react-redux";

import {Box} from "@mui/material";

import SectionRemoteProjectContainerConnecting from "./SectionRemoteProjectContainerConnecting";
import SectionRemoteProjectContainerConnected from "./SectionRemoteProjectContainerConnected";
import SectionRemoteProjectContainerDisconnected from "./SectionRemoteProjectContainerDisconnected";

import useRemoteProjectContainerProps from "../hooks/useRemoteProjectContainerProps";
import SectionRemoteProjectContainerSelection from "./SectionRemoteProjectContainerSelection";

export default function SectionRemoteProjectContainer() {
  // data

  const {value: props, loading: loadingProps} =
    useRemoteProjectContainerProps();

  const selectedRemoteProjectsContainer = useSelector(
    (s) => s.sync.selectedRemoteProjectsContainer
  );

  // helper

  const isConnected = props && !loadingProps;
  const isDisconnected = !props && !loadingProps;
  const isConnecting = loadingProps;
  const isSelecting = Boolean(selectedRemoteProjectsContainer);

  return (
    <Box>
      {isConnecting && <SectionRemoteProjectContainerConnecting />}
      {isConnected && <SectionRemoteProjectContainerConnected />}
      {isDisconnected && !isSelecting && (
        <SectionRemoteProjectContainerDisconnected />
      )}
      {isDisconnected && isSelecting && (
        <SectionRemoteProjectContainerSelection />
      )}
    </Box>
  );
}
