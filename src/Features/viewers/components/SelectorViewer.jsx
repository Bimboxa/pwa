import { useDispatch } from "react-redux";

import { setSelectedViewerKey } from "../viewersSlice";

import useViewers from "../hooks/useViewers";

import { Box, Tooltip, Typography } from "@mui/material";
import ButtonMenu from "Features/layout/components/ButtonMenu";

import useSelectedViewer from "../hooks/useSelectedViewer";

export default function SelectorViewer() {
  const dispatch = useDispatch();

  // string

  const selectS = "Module";

  // data

  const viewer = useSelectedViewer();
  const viewers = useViewers();

  // helpers

  const buttonLabel = viewer?.label;

  const actions = viewers.map((v) => ({
    key: v.key,
    label: v.label,
    icon: v.icon,
    handler: () => handleClick(v),
  }));

  // handler

  function handleClick(viewer) {
    dispatch(setSelectedViewerKey(viewer.key));
  }

  // return <BlockViewer viewer={viewer} />;

  return (

    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Typography sx={{ fontStyle: "italic" }} color="text.secondary" variant="body2">
        {selectS}
      </Typography>
      <Box sx={{ p: 0.5, bgcolor: "white", borderRadius: 1 }}>
        <ButtonMenu buttonLabel={buttonLabel} actions={actions} />
      </Box>
    </Box>

    // <ButtonMenuContainer buttonLabel={buttonLabel} sx={{width: 150}}>
    //   <ListViewers
    //     viewers={viewers}
    //     selectedKey={viewer.key}
    //     onClick={handleClick}
    //   />
    // </ButtonMenuContainer>
  );
}
