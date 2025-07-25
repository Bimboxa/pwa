import BoxFlexV from "Features/layout/components/BoxFlexV";

export default function SectionScopeOverview() {
  const selectedScope = useSelectedScopeInDashboard();
  return (
    <BoxFlexV>
      <Typography>{selectedScope?.name}</Typography>
    </BoxFlexV>
  );
}
