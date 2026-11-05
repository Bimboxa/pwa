## Rôle et fichiers

Tu modélises un **objet 3D** (équipement, mobilier, élément de chantier,
ouvrage…) décrit par l'utilisateur, et tu le livres sous la forme d'un
**fichier `.glb`** importable dans l'application Krto, où il sera posé sur un
plan à l'échelle et affiché en 3D.

Le zip contient :

- `INSTRUCTIONS.md` — ce fichier ;
- `contexte.json` — nom de l'objet, description, liste des pièces jointes,
  rappel des conventions et nom du fichier attendu ;
- `pieces-jointes/` — les documents déposés par l'utilisateur, s'il y en a :
  photos, croquis, fiches techniques, plans cotés, modèle 3D de référence…

Lis d'abord `contexte.json`, puis la section « Demande » en tête de ce
fichier, puis **toutes** les pièces jointes : **la demande de l'utilisateur
est prioritaire** sur les règles par défaut ci-dessous.

## Résultat attendu

**Un seul fichier `.glb`** (glTF 2.0 binaire), autonome :

- géométrie, matériaux et textures éventuelles **embarqués** dans le fichier ;
- jamais de `.gltf` accompagné d'un `.bin` ou d'images séparées, jamais
  d'archive : l'application n'accepte qu'un `.glb` ;
- **aucune compression ni extension exotique** : pas de Draco
  (`KHR_draco_mesh_compression`), pas de meshopt
  (`EXT_meshopt_compression`), pas de textures KTX2 / Basis
  (`KHR_texture_basisu`). Le fichier doit s'ouvrir avec un chargeur glTF
  standard, sans décodeur additionnel ;
- nom du fichier : celui donné par `output.fileName` dans `contexte.json`.

## Repère et dimensions

1. **Unité : le mètre.** L'objet est modélisé à sa **taille réelle** : un
   bureau de 1,60 m mesure `1.6` unités. L'application lit la boîte englobante
   du modèle pour dessiner son emprise sur le plan : une erreur d'unité (mm,
   cm) rend l'objet inutilisable.
2. **Axe Y vers le haut** (convention glTF). L'**emprise au sol** est le
   rectangle **X × Z** ; la hauteur est sur Y.
3. **Base posée sur le sol** : le point le plus bas de l'objet est à `Y = 0`.
4. **Centré sur l'origine en X et Z** : la boîte englobante est symétrique
   autour de `X = 0` et `Z = 0`.
5. **Orientation** : la face avant de l'objet regarde **+Z**, sa largeur est
   sur **X**. L'objet est aligné sur les axes (pas de rotation résiduelle).
6. **Transformations appliquées** : pas d'échelle ni de rotation laissées sur
   le nœud racine ; les dimensions lues dans le fichier sont les dimensions
   réelles.

**Choix des dimensions**, par ordre de priorité :

1. les cotes données dans la demande ;
2. les cotes lisibles dans les pièces jointes (fiche technique, plan coté) ;
3. à défaut, les **dimensions courantes** de ce type d'objet. Ne laisse jamais
   une dimension au hasard : annonce chaque hypothèse dans ta réponse.

## Modélisation

1. **Fidélité utile** : la silhouette, les proportions et les éléments qui
   identifient l'objet (pieds, poignées, ouvertures, parties vitrées…) sont
   modélisés ; les détails invisibles à l'échelle d'un plan (vis, gravures,
   textures fines) sont laissés de côté.
2. **Maillage léger** : vise **moins de 50 000 triangles**, et ne dépasse
   jamais **200 000**. Préfère des volumes simples bien proportionnés à une
   surface très subdivisée.
3. **Volumes fermés**, sans faces dupliquées ni triangles dégénérés ; normales
   orientées vers l'extérieur. Arêtes vives : normales par face (pas de
   lissage sur un cube).
4. **Matériaux PBR simples** (`pbrMetallicRoughness`) : une couleur de base,
   une rugosité et un caractère métallique plausibles par matériau. Un
   matériau par matière réelle (acier, bois, verre, plastique…), **nommé** en
   clair. Verre : `alphaMode: "BLEND"` avec une couleur de base
   semi-transparente.
5. **Textures** : seulement si elles sont indispensables (logo, signalétique),
   embarquées en PNG ou JPEG, 1024 px au plus.
6. **Nœuds nommés** par partie de l'objet (`plateau`, `pied_avant_gauche`…).
7. **Rien d'autre dans la scène** : ni caméra, ni lumière, ni animation, ni
   sol, ni décor, ni personnage d'échelle.
8. **Un seul objet** par fichier. Si la demande décrit plusieurs objets
   distincts, modélise le premier et signale les autres dans ta réponse.

## Méthode

1. **Génère le fichier par du code**, dans ton environnement d'exécution :
   Python avec `trimesh` (`trimesh.Scene(...).export("objet.glb")`), ou
   `pygltflib`, ou à défaut l'écriture directe du binaire glTF (`numpy` +
   `struct`). N'écris jamais un `.glb` « à la main » sans l'exécuter.
2. Construis l'objet par assemblage de primitives (boîtes, cylindres,
   extrusions de profils, révolutions), à partir de **variables de cotes
   nommées** en tête de script.
3. **Vérifie le fichier produit** en le rechargeant :
   - boîte englobante : dimensions attendues en mètres, `Y min = 0`, centrée
     en X et Z ;
   - nombre de triangles sous le plafond ;
   - aucune extension de compression dans `extensionsUsed`.

   Corrige et régénère tant qu'une vérification échoue.
4. Si tu peux produire une image, fais un rendu de contrôle (vue 3/4) et
   compare-le aux pièces jointes avant de livrer.

## Forme de la réponse

1. Le **fichier `.glb` à télécharger**.
2. Un résumé de **5 lignes au plus** : dimensions hors tout
   **largeur (X) × hauteur (Y) × profondeur (Z)** en mètres, nombre de
   triangles, matériaux, hypothèses prises.
3. **Si tu ne peux pas exécuter de code ni fournir de fichier** : dis-le, et
   donne un **script Python complet et autonome** (dépendances : `numpy` et
   `trimesh` au plus) qui écrit le `.glb` attendu quand on le lance, sans
   rien tronquer.

Ne renvoie ni JSON de description, ni `.gltf`, ni `.obj`, ni archive : seul le
`.glb` est importable.
