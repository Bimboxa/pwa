const randomShapesMap = {};

const length = 100;
const count = 100;

for (let i = 0; i < count; i++) {
  const centerX = Math.random() * length - length / 2;
  const centerY = Math.random() * length - length / 2;
  const zInf = Math.random() * length - length / 2;
  const halfSide = 0.5;

  randomShapesMap[i] = {
    id: i,
    name: `Shape ${i}`,
    color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    points: [
      {x: centerX - halfSide, y: centerY - halfSide},
      {x: centerX + halfSide, y: centerY - halfSide},
      {x: centerX + halfSide, y: centerY + halfSide},
      {x: centerX - halfSide, y: centerY + halfSide},
    ],
    zInf,
    height: 2 * halfSide,
  };
}

export default randomShapesMap;
