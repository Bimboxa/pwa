import { useId } from "react";

import SvgIcon from "@mui/material/SvgIcon";

// Base of the « Ouverture » (CUT) tool icons: a faded surface (the host
// polygon) pierced by an opening — `hole` is the black mask geometry carving
// the surface, `marks` the full-opacity details drawn over it (opening
// outline, click points). Each instance owns its mask id (useId) so several
// icons on the same page never share one.
export default function IconOpeningBase({ hole, marks, ...props }) {
  const maskId = `opening-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <defs>
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          {hole}
        </mask>
      </defs>
      {/* host surface, carved by the opening */}
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="1"
        fill="currentColor"
        opacity="0.4"
        mask={`url(#${maskId})`}
      />
      {marks}
    </SvgIcon>
  );
}
