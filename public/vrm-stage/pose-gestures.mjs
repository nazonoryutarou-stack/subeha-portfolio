/* VRM STAGE touch pose helpers. Intentionally independent of WebGL for Node tests. */
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = value => Math.max(-130, Math.min(130, value));

export function nearestPoseBone(points, clientX, clientY, radius = 48) {
 if (!finite(clientX) || !finite(clientY) || !Array.isArray(points)) return null;
 const maxDistanceSq = Math.max(0, radius) ** 2;
 let closest = null;
 let best = maxDistanceSq;
 for (const point of points) {
  if (!point || typeof point.name !== 'string' || !finite(point.x) || !finite(point.y)) continue;
  const distanceSq = (point.x - clientX) ** 2 + (point.y - clientY) ** 2;
  if (distanceSq <= best) { best = distanceSq; closest = point.name; }
 }
 return closest;
}

/* Up/down tilts the selected bone around X. Left/right rotates around Z.
   Y twist remains accessible on the existing three-axis sliders. */
export function dragPoseAngles(initial, deltaX, deltaY, sensitivity = 0.45) {
 const input = Array.isArray(initial) && initial.length === 3 ? initial : [0, 0, 0];
 const angle = index => finite(input[index]) ? input[index] : 0;
 const dx = finite(deltaX) ? deltaX : 0;
 const dy = finite(deltaY) ? deltaY : 0;
 const scale = finite(sensitivity) ? Math.max(0, Math.min(2, sensitivity)) : 0.45;
 return [
  Math.round(clamp(angle(0) - dy * scale) * 10) / 10,
  Math.round(clamp(angle(1)) * 10) / 10,
  Math.round(clamp(angle(2) - dx * scale) * 10) / 10,
 ];
}
