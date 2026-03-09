import { useSelector, useDispatch } from "react-redux";

import { setSelectedTabId } from "../listingViewerSlice";

import { Tabs, Tab } from "@mui/material";

export default function PanelListingViewerTabs() {
  const dispatch = useDispatch();

  // data

  const tab = useSelector((s) => s.listingViewer.selectedTabId);

  // helpers - tabs

  const tabs = [
    { id: "ANNOTATION_TEMPLATES", label: "Modèles" },
    { id: "ENTITIES", label: "Objets" },
  ];

  const idx = tabs.map(({ id }) => id).indexOf(tab);

  // handlers

  function handleChange(e, idx) {
    dispatch(setSelectedTabId(tabs[idx]?.id));
  }

  // render

  return (
    <Tabs value={idx} onChange={handleChange}>
      {tabs.map(({ id, label }) => (
        <Tab key={id} label={label} id={id} />
      ))}
    </Tabs>
  );
}
