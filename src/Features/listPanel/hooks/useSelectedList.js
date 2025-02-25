import {useSelector} from "react-redux";

export default function useSelectedList() {
  const selectedListId = useSelector((s) => s.listPanel.selectedListId);

  if (selectedListId === null) {
    return {id: "shape-list", type: "SHAPES", name: "Formes"};
  }
}
