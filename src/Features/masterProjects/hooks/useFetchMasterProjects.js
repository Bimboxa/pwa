import { useDispatch } from "react-redux";
import { addMasterProjects } from "../masterProjectsSlice";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import transformObject from "Features/misc/utils/transformObject";

import resolveUrl from "Features/appConfig/utils/resolveUrl";

export default function useFetchMasterProjects() {
    const dispatch = useDispatch();
    const appConfig = useAppConfig();

    // On sécurise l'accès au tableau. Si undefined, on prend un tableau vide.
    const sources = appConfig?.features?.masterProjects?.origins || [];

    return async (options) => {

        const filterByOriginKey = options?.filterByOriginKey;

        // Sécurité supplémentaire : si pas de sources, on ne fait rien
        console.log("debug_fetch_masterProjects sources", sources);

        let projects = [];

        if (!sources.length) return projects;

        for (let source of sources) {
            // 1. On démarre le bloc TRY dès le début de la boucle
            try {
                // Initialisation des variables à l'intérieur du try (sécurité)
                const fetchParams = source.fetchParams;
                const mapping = source.mapping;
                const disabled = source.disabled;

                if (disabled || (filterByOriginKey && filterByOriginKey !== source.key)) continue;

                // Si fetchParams n'existe pas, on lance une erreur manuelle pour passer au suivant
                if (!fetchParams) throw new Error("fetchParams manquant pour cette source");

                const { url, method, jwt, body } = fetchParams;

                const resolvedUrl = resolveUrl(url);

                console.log("debug_fetch_masterProjects start", resolvedUrl, fetchParams);

                const response = await fetch(resolvedUrl, {
                    method,
                    headers: {
                        ...(jwt && { Authorization: `Bearer ${jwt}` }),
                        "Content-Type": "application/json",
                    },
                    body: body ? JSON.stringify(body) : undefined, // Gestion propre du body
                });

                // 2. Gestion explicite des erreurs HTTP (404, 500...)
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status} pour l'url ${url}`);
                }

                const data = await response.json();

                console.log("debug_fetch_masterProjects data", source, data);

                // 3. Vérification que data est bien un tableau avant de mapper
                if (!Array.isArray(data)) {
                    throw new Error("Le format des données reçues n'est pas un tableau");
                }

                const masterProjects = data.map(item => transformObject(item, mapping));

                dispatch(addMasterProjects(masterProjects));

                projects = [...projects, ...masterProjects];

            } catch (error) {
                // En cas d'erreur sur CETTE source
                console.error("debug_fetch_masterProjects error sur une source", error);

                // On passe explicitement à la source suivante (optionnel mais clair)
                continue;
            }
        }
    };
}