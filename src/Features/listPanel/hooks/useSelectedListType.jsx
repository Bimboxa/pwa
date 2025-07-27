import { useSelector } from "react-redux";

import listTypes from "../data/listTypes";

export default function useSelectedListType() {
  const listTypeKey = useSelector((s) => s.listPanel.selectedListTypeKey);

  return listTypes.find((t) => t.key === listTypeKey);
}
