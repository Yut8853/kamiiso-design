attribute float aPhase;
attribute float aSpeed;
attribute float aScale;
uniform float uTime;
uniform vec2 uPointer;
uniform float uSizeMultiplier;
varying vec3 vColor;

void main() {
  vec3 animated = position;
  animated.x += cos(uTime * aSpeed + aPhase) * aScale;
  animated.y += sin(uTime * aSpeed * 1.35 + aPhase) * aScale * 1.5;
  animated.z += sin(uTime * aSpeed * 0.8 + aPhase) * 0.22;

  float cx = cos(uPointer.y);
  float sx = sin(uPointer.y);
  float cy = cos(uPointer.x);
  float sy = sin(uPointer.x);
  animated = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy) * animated;
  animated = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx) * animated;

  vec4 mvPosition = modelViewMatrix * vec4(animated, 1.0);
  gl_PointSize = 80.0 * uSizeMultiplier * (1.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  vColor = color;
}
