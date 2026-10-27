import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDiagramHighlight from "../hooks/useDiagramHighlight";

import LayoutDiagramSection from "./LayoutDiagramSection";
import SvgAppSkeleton from "./SvgAppSkeleton";

import { APP_COMPONENTS } from "../data/startingAppComponents";
import getStartingVocabulary from "../utils/getStartingVocabulary";

// « Naviguer dans l'appli »: the key components of the editor screen and the
// skeleton of the layout; the highlighted component lights up its zone.
export default function SectionNavigateApp() {
  // strings

  const titleS = "Composants de l'écran";
  const introS =
    "Survolez ou cliquez un composant pour le repérer dans le squelette de l'application.";
  const noteS =
    "Le squelette montre le module Dessin avec le panneau du module épinglé et la barre de commandes ancrée à gauche de l'éditeur ; la barre d'outils est à droite.";

  // data

  const appConfig = useAppConfig();

  // helpers

  const vocabulary = getStartingVocabulary(appConfig);
  const highlight = useDiagramHighlight(APP_COMPONENTS);

  // render

  return (
    <LayoutDiagramSection
      title={titleS}
      intro={introS}
      items={APP_COMPONENTS}
      vocabulary={vocabulary}
      highlight={highlight}
      note={noteS}
    >
      <SvgAppSkeleton
        highlightedZones={highlight.highlightedZones}
        onZoneClick={highlight.onZoneClick}
        vocabulary={vocabulary}
      />
    </LayoutDiagramSection>
  );
}
