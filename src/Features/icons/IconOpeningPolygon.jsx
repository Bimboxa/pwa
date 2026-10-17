import IconOpeningBase from "./IconOpeningBase";

const POINTS = "8,8.5 15,7 17.5,12.5 13.5,17.5 7.5,15";

// « Ouverture — Polyligne fermée » (CUT_CLICK): a free polygon cut out of the
// surface, its vertices marked as click points.
const IconOpeningPolygon = (props) => (
  <IconOpeningBase
    {...props}
    hole={<polygon points={POINTS} fill="black" />}
    marks={
      <>
        <polygon
          points={POINTS}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {POINTS.split(" ").map((p) => {
          const [x, y] = p.split(",");
          return <circle key={p} cx={x} cy={y} r="1.5" fill="currentColor" />;
        })}
      </>
    }
  />
);

export default IconOpeningPolygon;
