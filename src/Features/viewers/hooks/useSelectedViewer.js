import {useSelector} from "react-redux";

import useViewers from "./useViewers";

export default function useSelectedViewer() {
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const viewers = useViewers();

  const selectedViewer = viewers.find((v) => v.key === selectedViewerKey);

  return selectedViewer;
}
