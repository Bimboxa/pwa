import { useSelector } from "react-redux";

export default function useOpenListPanel() {
  // data

  const selectedListTypeKey = useSelector(
    (s) => s.listPanel.selectedListTypeKey
  );

  return Boolean(selectedListTypeKey);
}
