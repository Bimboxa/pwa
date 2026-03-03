export default [
  {
    key: "CUVELAGE_ETANTOP_AUTO",
    label: "Cuvelage - Etantop Auto",
    sourceListingKeys: ["CUVELAGE_OUVRAGES"],
    targetListingKeys: ["CUVELAGE_ETANTOP_302"],
    procedure: () => import("./cuvelageEtantopAuto"),
  },
];
