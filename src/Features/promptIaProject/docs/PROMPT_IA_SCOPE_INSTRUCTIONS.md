Le projet existe déjà dans l'application : tu ne crées **pas** de projet,
mais **un seul scope** (le « Krto ») à l'intérieur de ce projet. Les
instructions communes qui suivent décrivent la création d'un projet complet ;
applique-les avec les adaptations ci-dessous.

- `scopes` contient **exactement un** élément, dont `name` est le nom du Krto
  donné dans `contexte.json` (`scope.name`). N'en crée jamais un second, même
  si la description évoque plusieurs thèmes : répartis-les en plusieurs
  **listes** de ce scope.
- `project.name` et `project.clientRef` sont ignorés par l'application (tu
  peux les omettre ou recopier ceux de `contexte.json`).
- Les fonds de plan sont créés **uniquement** à partir des fichiers de
  `donnees/` : les plans déjà présents dans le projet ne te sont pas fournis
  et ne sont pas annotables ici.
- La clé `site` (adresse, référence satellite) et le positionnement des fonds
  restent autorisés et souhaités quand les documents le permettent.
- Partout où les instructions communes parlent de « scopes » au pluriel ou de
  « chaque scope », lis « le scope unique ».
- Dans le résumé final, décris ce scope : fonds de plan créés, listes,
  nombre de modèles et d'annotations, échelles retenues, ouvrages et points
  d'attention.
