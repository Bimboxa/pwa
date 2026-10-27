// Entries of the header band of the « Démarrer avec <appName> » dialog, in
// display order. They are numbered as a rocket countdown (3, 2, 1, 0: "take
// things in this order, then lift off"); `key` is the value stored in
// starting.sectionKey. The « Vidéo de prise en main » section
// (SectionVideo, appConfig features.starting.videoUrl) is not listed for
// now.
export const SECTIONS = [
  { key: "CONCEPTS", label: "Concepts clés" },
  { key: "NAVIGATE", label: "Naviguer dans l'appli" },
  { key: "KEYS", label: "Les touches clés" },
  { key: "GO", label: "GO" },
];

export const SECTIONS_BY_KEY = Object.fromEntries(
  SECTIONS.map((section) => [section.key, section])
);

// Countdown number of a section: 3 for the first, 0 for the last.
export function getSectionCountdown(sectionKey) {
  const index = SECTIONS.findIndex((s) => s.key === sectionKey);
  return index === -1 ? null : SECTIONS.length - 1 - index;
}
