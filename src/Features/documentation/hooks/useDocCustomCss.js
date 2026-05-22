import {useEffect} from "react";

const STYLE_TAG_ID = "documentation-custom-css";

export default function useDocCustomCss(customCss) {
  useEffect(() => {
    if (!customCss) return;
    const tag = document.createElement("style");
    tag.id = STYLE_TAG_ID;
    tag.textContent = customCss;
    document.head.appendChild(tag);
    return () => {
      tag.remove();
    };
  }, [customCss]);
}
