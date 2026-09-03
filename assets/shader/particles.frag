precision highp float;
varying vec3 vColor;

void main() {
  vec2 point = gl_PointCoord - 0.5;
  float distanceFromCenter = length(point);
  if (distanceFromCenter > 0.5) discard;
  float core = 1.0 - smoothstep(0.08, 0.24, distanceFromCenter);
  float halo = 1.0 - smoothstep(0.18, 0.5, distanceFromCenter);
  vec3 glowColor = mix(vColor, vec3(1.0), 0.24 + core * 0.22);
  float alpha = core * 0.46 + halo * 0.28;
  gl_FragColor = vec4(glowColor, alpha);
}
