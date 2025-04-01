import useIsMobile from "Features/layout/hooks/useIsMobile";
import LayerMapEditorDesktop from "./LayerMapEditorDesktop";
import LayerMapEditorMobile from "./LayerMapEditorMobile";

export default function LayerMapEditor() {
  // data

  const isMobile = useIsMobile();

  return <>{isMobile ? <LayerMapEditorMobile /> : <LayerMapEditorDesktop />}</>;
}
