const demoAnnotations = [
  {
    id: "demo1",
    type: "TEXT",
    x: 0.3,
    y: 0.3,
    value: "Annotation 1",
    fontSize: 16,
  },
  {
    id: "marker1",
    type: "MARKER",
    x: 0.12,
    y: 0.12,
    fillColor: "#e85426",
    iconKey: "drop",
  },
  {
    id: "polygon1",
    type: "POLYGON",
    // GeoJSON-style coordinates: [ [outer ring], [hole ring] ]
    points: [
      [
        [0.6, 0.2],
        [0.9, 0.2],
        [0.9, 0.6],
        [0.6, 0.6],
        [0.6, 0.2],
      ],
      [
        [0.7, 0.3],
        [0.8, 0.3],
        [0.8, 0.5],
        [0.7, 0.5],
        [0.7, 0.3],
      ],
    ],
  },
];

export default demoAnnotations;
