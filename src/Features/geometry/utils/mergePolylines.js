const DEFAULT_MAX_DIST_SQ = 10 * 10; // 10 px squared

/**
 * Merges multiple polylines into groups by chaining them
 * via closest endpoints, only when endpoints are within maxDistSq.
 *
 * @param {Array<Array<{id, x, y, type}>>} polylinesList
 * @param {number} [maxDistSq] - Maximum squared distance to allow chaining (default 100 = 10px)
 * @returns {Array<Array<{id, x, y, type}>>} array of merged polyline groups
 */
export default function mergePolylines(polylinesList, maxDistSq = DEFAULT_MAX_DIST_SQ) {
  if (!polylinesList || polylinesList.length === 0) return [];
  if (polylinesList.length === 1) return [[...polylinesList[0]]];

  const groups = [];
  let chain = [...polylinesList[0]];
  const pool = polylinesList.slice(1).map((p) => [...p]);

  while (pool.length > 0) {
    let bestIdx = -1;
    let bestDist = Infinity;
    let bestConnection = null;

    const chainStart = chain[0];
    const chainEnd = chain[chain.length - 1];

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const cStart = candidate[0];
      const cEnd = candidate[candidate.length - 1];

      const pairs = [
        { end: "end", candidateEnd: "start", dist: dist2(chainEnd, cStart) },
        { end: "end", candidateEnd: "end", dist: dist2(chainEnd, cEnd) },
        { end: "start", candidateEnd: "end", dist: dist2(chainStart, cEnd) },
        {
          end: "start",
          candidateEnd: "start",
          dist: dist2(chainStart, cStart),
        },
      ];

      for (const p of pairs) {
        if (p.dist < bestDist) {
          bestDist = p.dist;
          bestIdx = i;
          bestConnection = p;
        }
      }
    }

    // If the closest endpoint is too far, finalize the current chain and start a new group
    if (bestDist > maxDistSq) {
      groups.push(chain);
      chain = pool.splice(0, 1)[0];
      continue;
    }

    const candidate = pool.splice(bestIdx, 1)[0];
    const EPSILON = 1e-6;
    const skipShared = bestDist < EPSILON;

    if (bestConnection.end === "end" && bestConnection.candidateEnd === "start") {
      chain = chain.concat(skipShared ? candidate.slice(1) : candidate);
    } else if (bestConnection.end === "end" && bestConnection.candidateEnd === "end") {
      candidate.reverse();
      chain = chain.concat(skipShared ? candidate.slice(1) : candidate);
    } else if (bestConnection.end === "start" && bestConnection.candidateEnd === "end") {
      chain = (skipShared ? candidate.slice(0, -1) : candidate).concat(chain);
    } else {
      // start-start
      candidate.reverse();
      chain = (skipShared ? candidate.slice(0, -1) : candidate).concat(chain);
    }
  }

  groups.push(chain);
  return groups;
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
