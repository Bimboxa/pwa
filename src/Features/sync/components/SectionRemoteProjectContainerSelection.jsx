import {useSelector, useDispatch} from "react-redux";

import {setSelectedRemoteProjectsContainer} from "../syncSlice";

import {Box} from "@mui/material";

import PageProjectsFromRemoteContainer from "./PageProjectsFromRemoteContainer";

export default function SectionRemoteProjectContainerSelection() {
  const dispatch = useDispatch();

  // data

  const remoteContainer = useSelector(
    (s) => s.sync.selectedRemoteProjectsContainer
  );

  // handler

  function handleBackClick() {
    dispatch(setSelectedRemoteProjectsContainer(null));
  }

  return (
    <Box sx={{width: 1}}>
      <PageProjectsFromRemoteContainer
        remoteContainer={remoteContainer}
        onBackClick={handleBackClick}
      />
    </Box>
  );
}
