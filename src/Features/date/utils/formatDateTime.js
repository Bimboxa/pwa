import parseBackendDate from "./parseBackendDate";

/**
 * Formate un timestamp ISO en date+heure locale française (jj/mm/aaaa hh:mm).
 *
 * La normalisation UTC des timestamps backend sans fuseau est gérée par
 * parseBackendDate.
 */
export default function formatDateTime(iso) {
    if (!iso) return "";

    const d = parseBackendDate(iso);
    if (!d) return typeof iso === "string" ? iso : "";

    return d.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
