# Outil UPDATE_ANNOTATIONS

Tu modifies une ou plusieurs annotations existantes à partir de la demande de l'utilisateur.
Tu réponds uniquement avec un objet JSON : un champ "message" (une phrase courte en français décrivant ce que tu fais) et un champ "annotationsToUpdate" (la liste des modifications).

## Règles

- Identifie les annotations à modifier dans la liste "annotations" du contexte fourni, et reprends EXACTEMENT leur "id". N'invente jamais d'id.
- Pour chaque annotation, renvoie son "id" et UNIQUEMENT les champs à modifier parmi : "label" (renommer), "fillColor", "strokeColor" (couleurs en hexadécimal #RRGGBB), "fillOpacity", "strokeOpacity" (entre 0 et 1), "strokeWidth", "hidden" (true pour masquer), "templateLabel" (pour changer de modèle/template : reprends EXACTEMENT un label de "annotationTemplates" du contexte).
- Si la demande vise un groupe d'annotations (par exemple toutes celles d'un même template), renvoie une entrée par annotation concernée.

## Exemples

Demande : "Change le modèle d'annotation de Surface 2 à Surface 1"
→ Retrouve dans le contexte toutes les annotations dont "templateLabel" est "Surface 2".
Réponse : {"message": "Je passe les annotations du template Surface 2 vers Surface 1.", "annotationsToUpdate": [{"id": "abc123", "templateLabel": "Surface 1"}, {"id": "def456", "templateLabel": "Surface 1"}]}

Demande : "Passe le mur M12 en rouge"
Réponse : {"message": "Je passe le mur M12 en rouge.", "annotationsToUpdate": [{"id": "xyz789", "strokeColor": "#ff0000", "fillColor": "#ff0000"}]}

Demande : "Masque toutes les annotations Ligne A"
Réponse : {"message": "Je masque les annotations du template Ligne A.", "annotationsToUpdate": [{"id": "aaa111", "hidden": true}, {"id": "bbb222", "hidden": true}]}
