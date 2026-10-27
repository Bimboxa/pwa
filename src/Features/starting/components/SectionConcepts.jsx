import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDiagramHighlight from "../hooks/useDiagramHighlight";

import LayoutDiagramSection from "./LayoutDiagramSection";
import SvgConceptsDiagram from "./SvgConceptsDiagram";

import { CONCEPTS } from "../data/startingConcepts";
import getStartingVocabulary from "../utils/getStartingVocabulary";

// « Concepts clés »: the list of concepts and the synthesis diagram; the
// highlighted concept emphasizes its blocks in the diagram.
export default function SectionConcepts() {
  // strings

  const titleS = "Concepts clés";
  const introS =
    "Survolez ou cliquez un concept pour le repérer dans le schéma.";

  // data

  const appConfig = useAppConfig();

  // helpers

  const vocabulary = getStartingVocabulary(appConfig);
  const highlight = useDiagramHighlight(CONCEPTS);

  // render

  return (
    <LayoutDiagramSection
      title={titleS}
      intro={introS}
      items={CONCEPTS}
      vocabulary={vocabulary}
      highlight={highlight}
    >
      <SvgConceptsDiagram
        highlightedZones={highlight.highlightedZones}
        onZoneClick={highlight.onZoneClick}
        vocabulary={vocabulary}
      />
    </LayoutDiagramSection>
  );
}
