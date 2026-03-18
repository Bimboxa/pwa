import SvgIcon from "@mui/material/SvgIcon";

const IconTechnicalReturn = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* Peripheral wall (horizontal) */}
    <line
      x1="2"
      y1="18"
      x2="22"
      y2="18"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />

    {/* Inner wall (vertical) meeting the peripheral wall */}
    <line
      x1="10"
      y1="4"
      x2="10"
      y2="18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* 1m return segment (highlighted, along the peripheral wall) */}
    <line
      x1="10"
      y1="14"
      x2="10"
      y2="18"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      opacity="0.45"
    />

    {/* Small arrow / dimension mark for the 1m return */}
    <line
      x1="13"
      y1="14"
      x2="13"
      y2="18"
      stroke="currentColor"
      strokeWidth="1"
      strokeDasharray="1.5 1"
      opacity="0.5"
    />
    <text
      x="15"
      y="17"
      fill="currentColor"
      fontSize="5"
      fontWeight="bold"
      opacity="0.6"
    >
      1m
    </text>
  </SvgIcon>
);

export default IconTechnicalReturn;
