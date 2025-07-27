import { useSelector, useDispatch } from "react-redux";

import { setSelectedListTypeKey } from "../listPanelSlice";

import listTypes from "../data/listTypes";
import VerticalMenu from "Features/layout/components/VerticalMenu";

export default function MenuListTypes() {
  const dispatch = useDispatch();

  // helpers

  const menuItems = listTypes.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
  }));

  // data

  const selectedKey = useSelector((s) => s.listPanel.selectedListTypeKey);

  // handlers

  function handleChange(newKey) {
    dispatch(setSelectedListTypeKey(newKey));
  }

  return (
    <VerticalMenu
      menuItems={menuItems}
      selection={selectedKey}
      onSelectionChange={handleChange}
    />
  );
}
