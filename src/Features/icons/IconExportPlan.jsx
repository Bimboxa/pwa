import SvgIcon from "@mui/material/SvgIcon";

// Export-tool icon: a plan sheet (faint rooms inside) with an arrow taking
// its data out toward the top-right.
const IconExportPlan = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    {/* plan sheet, top-right corner open for the arrow */}
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6v2H5v14h14v-6h2v6a2 2 0 0 1-2 2z" />
    {/* faint floor-plan rooms inside the sheet */}
    <path d="M7 17h4v-4H7v4zm0-6h3V7H7v4zm5 6h5v-2h-5v2z" fillOpacity={0.3} />
    {/* export arrow */}
    <path d="M14 3h7v7h-2V6.41l-6.3 6.3-1.41-1.42L17.59 5H14V3z" />
  </SvgIcon>
);

export default IconExportPlan;
