import { useSelector } from "react-redux";
import useOpenCreateItemPanel from "./useOpenCreateItemPanel";

export default function useOpenListPanel() {
  // data

  const selectedListTypeKey = useSelector(
    (s) => s.listPanel.selectedListTypeKey
  );

  const openCreateItemPanel = useOpenCreateItemPanel();

  return Boolean(selectedListTypeKey) || openCreateItemPanel;
}
