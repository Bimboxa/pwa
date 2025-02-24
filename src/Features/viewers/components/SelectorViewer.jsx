import useSelectedViewer from "../hooks/useSelectedViewer";
import BlockViewer from "./BlockViewer";

export default function SelectorViewer() {
  const viewer = useSelectedViewer();
  return <BlockViewer viewer={viewer} />;
}
