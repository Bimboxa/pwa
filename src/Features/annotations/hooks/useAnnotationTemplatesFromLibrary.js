import { useEffect, useState } from "react";

import { nanoid } from "@reduxjs/toolkit";

// Dynamic loader for annotation templates library
const LIBRARY_LOADER = import.meta.glob(
  "../../../App/data/annotationTemplatesLibrary.js",
  {
    eager: false,
  }
);

export default function useAnnotationTemplatesFromLibrary(options) {
  const [library, setLibrary] = useState([]);

  const addId = options?.addId;

  useEffect(() => {
    async function loadLibrary() {
      try {
        const loader =
          LIBRARY_LOADER["../../../App/data/annotationTemplatesLibrary.js"];
        if (loader) {
          const module = await loader();
          let templates = module.default || [];
          if (addId) {
            templates = templates.map((template) => ({
              ...template,
              id: nanoid(),
            }));
          }
          setLibrary(templates);
        } else {
          console.warn(
            "[useAnnotationTemplatesFromLibrary] annotationTemplatesLibrary.js not found"
          );
          setLibrary([]);
        }
      } catch (error) {
        console.error(
          "[useAnnotationTemplatesFromLibrary] Error loading library:",
          error
        );
        setLibrary([]);
      }
    }

    loadLibrary();
  }, []);

  return library;
}
