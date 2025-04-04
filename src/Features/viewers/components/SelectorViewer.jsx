import {useDispatch} from "react-redux";

import {setSelectedViewerKey} from "../viewersSlice";

import useViewers from "../hooks/useViewers";

import ListViewers from "./ListViewers";
import ButtonMenuContainer from "Features/layout/components/ButtonMenuContainer";

import useSelectedViewer from "../hooks/useSelectedViewer";

export default function SelectorViewer() {
  const dispatch = useDispatch();

  // data

  const viewer = useSelectedViewer();
  const viewers = useViewers();

  // helpers

  const buttonLabel = viewer.label;

  // handler

  function handleClick(viewer) {
    dispatch(setSelectedViewerKey(viewer.key));
  }

  // return <BlockViewer viewer={viewer} />;

  return (
    <ButtonMenuContainer buttonLabel={buttonLabel}>
      <ListViewers
        viewers={viewers}
        selectedKey={viewer.key}
        onClick={handleClick}
      />
    </ButtonMenuContainer>
  );
}
