import SvgIcon from "@mui/material/SvgIcon";

// Annotation (pentagon outline) with a "−" badge: excludes annotations of a
// template linked to a business object by clicking them on the map (picking
// mode "EXCLUDE").
const IconAnnotationLinkRemove = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <polygon
      points="10.5,3 18.5,8.8 15.5,18 5.5,18 2.5,8.8"
      fill="currentColor"
      fillOpacity={0.15}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="18" cy="18" r="5.5" fill="currentColor" />
    <path d="M15 18h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
  </SvgIcon>
);

export default IconAnnotationLinkRemove;
