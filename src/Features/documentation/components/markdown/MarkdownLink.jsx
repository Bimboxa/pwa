import {Link as RouterLink} from "react-router-dom";

import {Link as MuiLink} from "@mui/material";

import resolveInternalDocLink from "../../utils/resolveInternalDocLink";

export default function MarkdownLink({href, children, pageId, ...rest}) {
  const internal = resolveInternalDocLink(href, {pageId});

  if (internal) {
    return (
      <MuiLink component={RouterLink} to={internal} underline="hover">
        {children}
      </MuiLink>
    );
  }

  if (href?.startsWith("#")) {
    return (
      <MuiLink href={href} underline="hover">
        {children}
      </MuiLink>
    );
  }

  return (
    <MuiLink
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      {...rest}
    >
      {children}
    </MuiLink>
  );
}
