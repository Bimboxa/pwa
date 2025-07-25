import listTypes from "../data/listTypes";
import VerticalMenu from "Features/layout/components/VerticalMenu";

export default function MenuListTypes() {
  const menuItems = listTypes.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
  }));

  return <VerticalMenu menuItems={menuItems} />;
}
