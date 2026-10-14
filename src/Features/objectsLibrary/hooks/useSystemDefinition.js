import { useEffect, useState } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import matchAnnotationTemplate from "Features/annotationsAuto/utils/matchAnnotationTemplate";

// Dynamic loader for all annotationTemplatesLibraries files under Data/*/ — same
// pattern as useAnnotationTemplatesFromLibrary, but here we keep the raw library
// objects so we can resolve one BY KEY (the flat hook drops `key`).
const LIBRARY_LOADERS = import.meta.glob(
  "../../../Data/*/annotationTemplatesLibraries.js",
  { eager: false }
);

// Resolve a "Système" object (a manifest entry carrying `procedureKey` +
// `templateLibraryKey`) into the data the système dialog renders:
//   - procedure          : the ANNOTATIONS_CREATOR procedure metadata (label,
//                          description, createdMappingCategories) from appConfig
//   - mainTemplate       : the source template the user draws (the library
//                          template whose `procedureKeys` includes the procedure)
//   - generatedTemplates : the templates the procedure creates, resolved from
//                          `procedure.createdMappingCategories` via
//                          matchAnnotationTemplate (same rule as fromPolygonsToBim)
//
// The library templates come straight from the source library (not from Dexie),
// which is fine: matchAnnotationTemplate only inspects `mappingCategories`.
// Registry entries chained to a procedure (chainedProcedureKeys, transitive,
// registry order, no duplicates).
function collectChainedProcedures(procedure, procedures) {
  const out = [];
  const seen = new Set(procedure ? [procedure.key] : []);
  const queue = [...(procedure?.chainedProcedureKeys ?? [])];
  while (queue.length > 0) {
    const key = queue.shift();
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = procedures.find((p) => p.key === key);
    if (!entry) continue;
    out.push(entry);
    queue.push(...(entry.chainedProcedureKeys ?? []));
  }
  return out;
}

export default function useSystemDefinition(object) {
  const appConfig = useAppConfig();
  const configCode = import.meta.env.VITE_CONFIG_CODE;

  const procedureKey = object?.procedureKey;
  const templateLibraryKey = object?.templateLibraryKey;

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!templateLibraryKey) {
        if (!cancelled) {
          setTemplates([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const path = `../../../Data/${configCode}/annotationTemplatesLibraries.js`;
        const loader = LIBRARY_LOADERS[path];
        if (!loader) {
          console.warn(
            `[useSystemDefinition] No libraries found for configCode "${configCode}"`
          );
          if (!cancelled) {
            setTemplates([]);
            setLoading(false);
          }
          return;
        }
        const module = await loader();
        const libraries = module.default || [];
        const library = libraries.find((l) => l.key === templateLibraryKey);
        if (!cancelled) {
          setTemplates(library?.templates ?? []);
          setLoading(false);
        }
      } catch (error) {
        console.error("[useSystemDefinition] Error loading library:", error);
        if (!cancelled) {
          setTemplates([]);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [configCode, templateLibraryKey]);

  const procedure =
    (appConfig?.automatedAnnotationsProcedures ?? []).find(
      (p) => p.key === procedureKey
    ) ?? null;

  // Source template: the one whose procedureKeys trigger this procedure (e.g. Sol).
  const mainTemplate = procedureKey
    ? (templates.find((t) => (t.procedureKeys ?? []).includes(procedureKey)) ??
      null)
    : null;

  // Generated templates: one per created category, in the procedure's order —
  // then those of the procedures chained to it (registry
  // `chainedProcedureKeys`, e.g. the château d'eau surfaces drawn on top of
  // the walls): the système pre-creates the whole pipeline's templates.
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];
  const chainedProcedures = collectChainedProcedures(procedure, procedures);
  const createdCategories = [
    ...new Set(
      [procedure, ...chainedProcedures].flatMap(
        (p) => p?.createdMappingCategories ?? []
      )
    ),
  ];
  const generatedTemplates = createdCategories
    .map((category) => matchAnnotationTemplate(templates, [category]))
    .filter(Boolean);

  // Procedures launched from the listing (the chained ones): written on the
  // target listing's procedureKeys when the système is materialized.
  const listingProcedureKeys = chainedProcedures.map((p) => p.key);

  return {
    procedure,
    mainTemplate,
    generatedTemplates,
    listingProcedureKeys,
    loading,
  };
}
