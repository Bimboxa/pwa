import { useSelector, useDispatch } from "react-redux";

import { setSelectedTab } from "../baseMapEditorSlice";

import { Tabs, Tab } from "@mui/material";

export default function SectionBaseMapEditorTabs() {
  const dispatch = useDispatch();

  // data

  const tab = useSelector((s) => s.baseMapEditor.selectedTab);

  // helpers - tabs

  const tabs = [
    { id: "INFO", label: "Info" },
    { id: "TOOLS", label: "Outils" },
    { id: "ANNOTATIONS", label: "Annotations" },
  ];

  const idx = tabs.map(({ id }) => id).indexOf(tab);

  // handlers

  function handleChange(e, idx) {
    dispatch(setSelectedTab(tabs[idx]?.id));
  }

  return (
    <Tabs value={idx} onChange={handleChange}>
      {tabs.map(({ id, label }) => {
        return <Tab key={id} label={label} id={id} />;
      })}
    </Tabs>
  );
}
