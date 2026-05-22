import {useEffect, useState} from "react";

import parseFrontmatter from "../utils/parseFrontmatter";

export default function useDocPage(pageId, pageLoaders) {
  const [state, setState] = useState({
    status: "idle",
    content: "",
    frontmatter: {},
  });

  useEffect(() => {
    let cancelled = false;

    if (!pageId || !pageLoaders) {
      setState({status: "idle", content: "", frontmatter: {}});
      return;
    }

    const loader = pageLoaders[pageId];
    if (!loader) {
      setState({status: "notfound", content: "", frontmatter: {}});
      return;
    }

    setState((s) => ({...s, status: "loading"}));
    loader()
      .then((raw) => {
        if (cancelled) return;
        const {data, content} = parseFrontmatter(raw);
        setState({status: "ready", content, frontmatter: data});
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[useDocPage] load error", err);
        setState({status: "error", content: "", frontmatter: {}});
      });

    return () => {
      cancelled = true;
    };
  }, [pageId, pageLoaders]);

  return state;
}
