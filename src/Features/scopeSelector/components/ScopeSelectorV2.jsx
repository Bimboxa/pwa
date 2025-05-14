import {useState, useEffect} from "react";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import PanelSelectProjectAndScope from "./PanelSelectProjectAndScope";
import PanelSelectedScope from "./PanelSelectedScope";

export default function ScopeSelectorV2({containerEl}) {
  // data

  const {value: selectedScope} = useSelectedScope();

  // state

  const [openSelector, setOpenSelector] = useState(false);

  useEffect(() => {
    if (!selectedScope) {
      setOpenSelector(true);
    } else {
      setOpenSelector(false);
    }
  }, [selectedScope?.id]);

  if (openSelector)
    return <PanelSelectProjectAndScope containerEl={containerEl} />;

  return <PanelSelectedScope onMoreClick={() => setOpenSelector(true)} />;
}
