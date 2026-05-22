import {Prism as SyntaxHighlighter} from "react-syntax-highlighter";
import {oneLight} from "react-syntax-highlighter/dist/esm/styles/prism";

import {Box} from "@mui/material";

export default function MarkdownCode({inline, className, children, ...rest}) {
  const text = String(children ?? "").replace(/\n$/, "");

  if (inline) {
    return (
      <Box
        component="code"
        sx={{
          px: 0.5,
          py: 0.1,
          borderRadius: 0.5,
          fontFamily: "monospace",
          fontSize: "0.9em",
          bgcolor: "grey.100",
        }}
        {...rest}
      >
        {children}
      </Box>
    );
  }

  const langMatch = /language-(\w+)/.exec(className ?? "");
  const language = langMatch?.[1];

  return (
    <SyntaxHighlighter
      language={language ?? "text"}
      style={oneLight}
      customStyle={{
        margin: "16px 0",
        padding: "12px 16px",
        borderRadius: 6,
        fontSize: "0.9em",
      }}
      PreTag="div"
    >
      {text}
    </SyntaxHighlighter>
  );
}
