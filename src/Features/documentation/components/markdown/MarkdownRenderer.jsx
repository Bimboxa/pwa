import {useMemo} from "react";

import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import buildMarkdownComponents from "./markdownComponents";

export default function MarkdownRenderer({content, pageId, imageLoaders}) {
  const components = useMemo(
    () => buildMarkdownComponents({pageId, imageLoaders}),
    [pageId, imageLoaders]
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
