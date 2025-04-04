import {useDispatch} from "react-redux";

import useRemoteProjectsContainers from "../hooks/useRemoteProjectsContainers";
import {setSelectedRemoteProjectsContainer} from "../syncSlice";
import ListRemoteProjectsContainers from "./ListRemoteProjectsContainers";

import {Box, Typography} from "@mui/material";

export default function SectionRemoteProjectContainerDisconnected() {
  const dispatch = useDispatch();

  // strings

  const title = "Synchronisez vos donnez avec";

  //data

  const {value: items} = useRemoteProjectsContainers();

  // handlers

  function handleClick(container) {
    dispatch(setSelectedRemoteProjectsContainer(container));
  }

  return (
    <Box>
      <Box sx={{p: 1}}>
        <Typography color="text.secondary" variant="body2" sx={{mr: 6}}>
          {title}
        </Typography>
      </Box>
      <Box sx={{bgcolor: "white"}}>
        <ListRemoteProjectsContainers items={items} onClick={handleClick} />
      </Box>
    </Box>
  );
}
