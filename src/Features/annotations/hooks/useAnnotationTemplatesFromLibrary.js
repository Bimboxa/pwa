import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { nanoid } from "@reduxjs/toolkit";


// Dynamic loader for all annotationTemplatesLibraries files under Data/*/
const LIBRARY_LOADERS = import.meta.glob(
  "../../../Data/*/annotationTemplatesLibraries.js",
  { eager: false }
);

export default function useAnnotationTemplatesFromLibrary(options) {
  const [library, setLibrary] = useState([]);

  const configCode = import.meta.env.VITE_CONFIG_CODE;

  const addId = options?.addId;

  useEffect(() => {
    async function loadLibrary() {
      try {
        const path = `../../../Data/${configCode}/annotationTemplatesLibraries.js`;
        const loader = LIBRARY_LOADERS[path];

        if (!loader) {
          console.warn(
            `[useAnnotationTemplatesFromLibrary] No library found for configCode "${configCode}"`
          );
          setLibrary([]);
          return;
        }

        const module = await loader();
        const libraries = module.default || [];

        // Flatten: each library has a .templates array
        // We merge all templates into a flat array, preserving the library info as `group`
        let templates = libraries.flatMap((lib) =>
          (lib.templates || []).map((template) => ({
            ...template,
            group: template.group || lib.name,
          }))
        );

        if (addId) {
          templates = templates.map((template) => ({
            ...template,
            id: nanoid(),
          }));
        }

        setLibrary(templates);
      } catch (error) {
        console.error(
          "[useAnnotationTemplatesFromLibrary] Error loading library:",
          error
        );
        setLibrary([]);
      }
    }

    loadLibrary();
  }, [configCode, addId]);

  return library;
}
