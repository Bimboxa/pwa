const initialTransforms = [
    {
        id: "1",
        name: "Image satellite => plan masse",
        prompt: `Génère un plan masse à partir d'une image satellite

A partir de la photo satellite jointe, génère un plan masse d’architecte. Conserve le plan général, les formes et les dimensions. Les dimensions de l'image générées doivent êtres exactement les même que l'image fournit, car je dois pouvoir superposer les 2 images. L'image générée doit donc être carrée (aspect ratio 1:1)

Reproduit fidèlement la forme des bâtiments, les routes, tous les détails présents sur les toitures et mets les bien en évidence par rapport au reste, notamment la végétation. Retire tous les noms d’emplacement et annotations de la photo. N’ajoute pas d’éléments qui n’existent pas et conserve tous les détails.

Le style du plan masse final doit être celui d’un ingénieur ou architecte précis, et ayant un fort sens esthétique. Le plan doit être clair et très précis. Les lignes (contours, hachures) sont nettes et bien définies. Le plan doit être en niveau de gris, sans couleur. N'ajoute pas d'ombre ou d'effets lumineux particulier.

Cas particulier des routes : elles doivent être blanches, sans texture, avec des bords nets. Dessine nettement les passages pietons et lignes de démarcation.

Cas particulier des toitures de bâtiment: elles doivent être blanches, sans texture, avec des bords nets. Les ouvertures ou édicules présents sur la toiture doivent être repérés avec des bords nets. Plus généralement, soit particulièrement attentif à tous les motifs rectangulaires ou les lignes de démarcation présents sur la toiture, et dessinent les avec des bords nets. 

Remarque: Le contraste de la surface courante de la toiture avec ces motifs rectangulaires et lignes de démarcation peut être faible sur l'image satellite si la toiture est claire. Soit bien attentif.

Cas particulier des parkings: comme pour les toiture, ils sont blancs, les places de stationnement et les bordures de trottoirs sont repérés avec des bords nets.

Cas particulier de la végétation (arbres, forêt) : dessine les avec un sens de l'esthétique fort, avec quelques détails.

Cas particulier de la végétation (champs / pelouse) : utilise une texture plutôt qu'une teinte uniforme.`
    },
    {
        id: "2",
        name: "Nettoyage de plan GO",
        prompt: `Tu es un dessinateur projeteur dans un bureau d'étude / cabinet d'architecte.
Ta mission est de générer un plan à partir d'un plan initial. 
Sur le plan final, tu dois uniquement faire figurer les éléments structurels : murs en béton, poteau,... 
Tu retires tout le reste, notamment les annotations, les files, les cotations.
Retourne un plan où tous les traits sont bien nets et précis.`
    }
];

export default initialTransforms