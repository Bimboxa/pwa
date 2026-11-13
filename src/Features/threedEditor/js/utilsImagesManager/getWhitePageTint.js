import { Euler, Vector3 } from "three";

import { BASE_MAP_ROTATION_ORDER } from "Features/baseMaps/js/getBaseMapTransform";

// Grey factor (0..1, display space) of a white page plane in 3D, from its
// orientation. Two white pages that cross each other are otherwise the exact
// same unlit white: their overlap and their intersection line are unreadable.
//
// A fake light, FIXED in the world (not tied to the camera, so the tint does
// not flicker while orbiting):
// - horizontal page: 1 (pure white, the historical look);
// - vertical page: between VERTICAL_TINT_MIN and VERTICAL_TINT_MAX depending
//   on its azimuth, so two vertical pages with different angles differ too.
//
// The orientation MUST come from the base map data (getBaseMapEuler), never
// from group.rotation: on the base maps grid the group lies in a table pose.

const VERTICAL_TINT_MIN = 0.95;
const VERTICAL_TINT_MAX = 0.98;

// Azimuth of the fake light. Off the main axes on purpose: pages at 0° / 90°
// (the common case) and at 45° / 135° both get distinct tints.
const LIGHT_AZIMUTH_RAD = (20 * Math.PI) / 180;
const LIGHT_X = Math.sin(LIGHT_AZIMUTH_RAD);
const LIGHT_Z = Math.cos(LIGHT_AZIMUTH_RAD);

const _euler = new Euler();
const _normal = new Vector3();

export default function getWhitePageTint(euler) {
  if (!euler) return 1;
  _euler.set(euler.x ?? 0, euler.y ?? 0, euler.z ?? 0, BASE_MAP_ROTATION_ORDER);
  // the plane lies in the group's local XY plane
  _normal.set(0, 0, 1).applyEuler(_euler);

  const verticality = 1 - Math.min(1, Math.abs(_normal.y));
  if (verticality <= 0) return 1;

  const horizontalLength = Math.hypot(_normal.x, _normal.z) || 1;
  const facing = Math.abs(
    (_normal.x * LIGHT_X + _normal.z * LIGHT_Z) / horizontalLength
  );
  const verticalTint =
    VERTICAL_TINT_MIN + (VERTICAL_TINT_MAX - VERTICAL_TINT_MIN) * facing;

  return 1 - verticality * (1 - verticalTint);
}
