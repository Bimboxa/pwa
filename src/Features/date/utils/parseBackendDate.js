/**
 * Parse un timestamp renvoyé par le backend en objet Date.
 *
 * Le backend renvoie des timestamps UTC SANS indicateur de fuseau
 * (ex. "2026-05-18T10:59:00"). new Date() interprète une date-heure sans
 * offset comme heure LOCALE : sans normalisation l'heure UTC s'affichait
 * telle quelle (décalage de 2h en CEST). On force donc l'interprétation UTC
 * quand aucun fuseau n'est présent ; un timestamp contenant déjà Z ou un
 * offset, un epoch ou un objet Date sont laissés intacts.
 *
 * @returns {Date|null} null si la valeur est absente ou invalide.
 */
const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/;
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export default function parseBackendDate(value) {
    if (value == null || value === "") return null;

    let normalized = value;
    if (typeof value === "string") {
        normalized = value.trim();
        if (NAIVE_DATETIME.test(normalized) && !HAS_TZ.test(normalized)) {
            normalized = normalized.replace(" ", "T") + "Z";
        }
    }

    const date = new Date(normalized);
    return isNaN(date.getTime()) ? null : date;
}
