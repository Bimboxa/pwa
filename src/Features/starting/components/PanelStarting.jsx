import { useDispatch, useSelector } from "react-redux";

import {
  selectStartingSectionKey,
  setStartingSectionKey,
} from "../startingSlice";

import { Box, Divider } from "@mui/material";

import NavStartingList from "./NavStartingList";
import SectionConcepts from "./SectionConcepts";
import SectionNavigateApp from "./SectionNavigateApp";
import SectionKeyHints from "./SectionKeyHints";
import SectionVideo from "./SectionVideo";

// Body of the starting dialog: the small menu on the left, the selected
// section on the right.
export default function PanelStarting() {
  const dispatch = useDispatch();

  // data

  const sectionKey = useSelector(selectStartingSectionKey);

  // handlers

  function handleSelect(key) {
    dispatch(setStartingSectionKey(key));
  }

  // render

  let section = null;
  if (sectionKey === "CONCEPTS") section = <SectionConcepts />;
  else if (sectionKey === "NAVIGATE") section = <SectionNavigateApp />;
  else if (sectionKey === "KEYS") section = <SectionKeyHints />;
  else if (sectionKey === "VIDEO") section = <SectionVideo />;

  return (
    <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
      <NavStartingList sectionKey={sectionKey} onSelect={handleSelect} />
      <Divider orientation="vertical" flexItem />
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          overflow: "auto",
          bgcolor: "background.default",
        }}
      >
        {section}
      </Box>
    </Box>
  );
}
