import { useSelector, useDispatch } from "react-redux";

import { setSelectedTabInLeftPanel } from "../locatedEntitiesSlice";

import { Tabs, Tab } from "@mui/material";

export default function SectionLocatedEntitiesInListPanelTabs() {
  const dispatch = useDispatch();

  // data

  const tab = useSelector((s) => s.locatedEntities.selectedTabInLeftPanel);

  // helpers - tabs

  const tabs = [
    { id: "ANNOTATION_TEMPLATES", label: "Modèles" },
    { id: "ENTITIES", label: "Objets" },
    { id: "ANNOTATIONS", label: "Annotations" },
  ];

  const idx = tabs.map(({ id }) => id).indexOf(tab);

  // handlers

  function handleChange(e, idx) {
    console.log("idx", idx);
    dispatch(setSelectedTabInLeftPanel(tabs[idx]?.id));
  }

  return (
    <Tabs value={idx} onChange={handleChange}>
      {tabs.map(({ id, label }) => {
        return <Tab key={id} label={label} id={id} />;
      })}
    </Tabs>
  );
}
