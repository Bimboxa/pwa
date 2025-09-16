import useIsMobile from "Features/layout/hooks/useIsMobile";
import LayerMapEditorDesktop from "./LayerMapEditorDesktop";
import LayerMapEditorMobile from "./LayerMapEditorMobile";

export default function LayerMapEditor({ svgElement }) {
  // data

  const isMobile = useIsMobile();

  return (
    <>
      {isMobile ? (
        <LayerMapEditorMobile svgElement={svgElement} />
      ) : (
        <LayerMapEditorDesktop svgElement={svgElement} />
      )}
    </>
  );
}
