/**
 * Formate un timestamp ISO en date+heure locale française (jj/mm/aaaa hh:mm).
 *
 * Le backend renvoie des timestamps UTC SANS indicateur de fuseau
 * (ex. "2026-05-18T10:59:00"). new Date() interprète une date-heure sans
 * offset comme heure LOCALE : sans normalisation l'heure UTC s'affichait
 * telle quelle (décalage de 2h en CEST). On force donc l'interprétation UTC
 * quand aucun fuseau n'est présent ; un timestamp contenant déjà Z ou un
 * offset est laissé intact.
 */
const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/;
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export default function formatDateTime(iso) {
    if (!iso) return "";
    try {
        let normalized = typeof iso === "string" ? iso.trim() : iso;

        if (
            typeof normalized === "string" &&
            NAIVE_DATETIME.test(normalized) &&
            !HAS_TZ.test(normalized)
        ) {
            normalized = normalized.replace(" ", "T") + "Z";
        }

        const d = new Date(normalized);
        if (isNaN(d.getTime())) return typeof iso === "string" ? iso : "";

        return d.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return typeof iso === "string" ? iso : "";
    }
}
