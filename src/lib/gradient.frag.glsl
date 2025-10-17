#ifdef GL_ES
precision mediump float;
#endif

#define MAX_POINTS 12

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_count;
uniform vec3 u_colors[MAX_POINTS];
uniform vec2 u_positions[MAX_POINTS];
uniform float u_radius;
uniform float u_intensity;
uniform float u_grainAmount;
uniform float u_grainSize;
uniform int u_warpMode;
uniform float u_warpSize;
uniform float u_warpAmount;
uniform float u_seed;

vec3 permute(vec3 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m * m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        f += amp * snoise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return f;
}

vec2 warpWave(vec2 uv, float t, float seed) {
    float phase = snoise(uv * (u_warpSize * 1.5 + 0.1) + vec2(seed * 5.0));
    float w1 = sin((uv.y * u_warpSize * 10.0) + t * 0.6 + phase * 6.28318);
    float w2 = cos((uv.x * u_warpSize * 8.0) + t * 0.4 - phase * 6.28318 * 0.5);
    vec2 disp = vec2(w1, w2) * (u_warpAmount * 0.5);
    disp.x *= u_resolution.x / u_resolution.y;
    return uv + disp;
}

vec2 warpSimplex(vec2 uv, float t, float seed) {
    vec2 noiseUv = uv * (u_warpSize * 4.0 + 0.001) + vec2(seed * 10.0, seed * 20.0);
    float n = snoise(noiseUv + vec2(t * 0.05));
    vec2 disp = vec2(n, snoise(noiseUv + vec2(12.34))) * u_warpAmount * 0.8;
    disp.x *= u_resolution.x / u_resolution.y;
    return uv + disp;
}

vec2 warpFBM(vec2 uv, float t, float seed) {
    vec2 noiseUv = uv * (u_warpSize * 3.0) + vec2(seed * 7.0);
    float f = fbm(noiseUv + vec2(t * 0.02));
    vec2 disp = vec2(f, fbm(noiseUv + vec2(31.4))) * u_warpAmount;
    disp.x *= u_resolution.x / u_resolution.y;
    return uv + disp;
}

vec2 warpRidged(vec2 uv, float t, float seed) {
    vec2 nUv = uv * (u_warpSize * 2.5) + vec2(seed * 9.0);
    float r = 1.0 - abs(fbm(nUv));
    vec2 disp = vec2(r, r * 0.5) * (u_warpAmount * 1.2);
    disp.x *= u_resolution.x / u_resolution.y;
    return uv + disp;
}

vec2 warpSwirl(vec2 uv, float t) {
    vec2 centered = uv - 0.5;
    float radius = length(centered);
    float angle = radius * u_warpSize * 5.0 - t * 0.5;
    float s = sin(angle) * u_warpAmount;
    float c = cos(angle) * u_warpAmount;
    centered = vec2(c * centered.x - s * centered.y, s * centered.x + c * centered.y);
    centered.x *= u_resolution.x / u_resolution.y;
    return centered + 0.5;
}

vec2 warpRadial(vec2 uv, float t) {
    vec2 centered = uv - 0.5;
    float r = length(centered);
    float theta = atan(centered.y, centered.x);
    float wave = sin(r * u_warpSize * 20.0 - t * 2.0) * u_warpAmount;
    r += wave;
    vec2 p;
    p.x = r * cos(theta);
    p.y = r * sin(theta);
    p.x *= u_resolution.x / u_resolution.y;
    return p + 0.5;
}

vec2 applyWarp(vec2 uv) {
    if (u_warpMode == 1) return warpWave(uv, u_time, u_seed);
    else if (u_warpMode == 2) return warpSimplex(uv, u_time, u_seed);
    else if (u_warpMode == 3) return warpFBM(uv, u_time, u_seed);
    else if (u_warpMode == 4) return warpRidged(uv, u_time, u_seed);
    else if (u_warpMode == 5) return warpSwirl(uv, u_time);
    else if (u_warpMode == 6) return warpRadial(uv, u_time);
    return uv;
}

float grain(vec2 uv) {
    float n = fract(sin(dot(uv * u_grainSize, vec2(12.9898, 78.233))) * 43758.5453);
    return n - 0.5;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 centered = uv - 0.5;
    uv = applyWarp(uv);

    float g = grain(gl_FragCoord.xy / u_resolution.xy);

    vec3 accum = vec3(0.0);
    float totalWeight = 0.0;
    for (int i = 0; i < MAX_POINTS; ++i) {
        if (i >= u_count) break;
        vec2 diff = uv - u_positions[i];
        diff.x *= u_resolution.x / u_resolution.y;
        float d = length(diff);
        float w = exp(- (d * d) / (u_radius * u_radius));
        w = pow(w, max(0.001, u_intensity));
        accum += u_colors[i] * w;
        totalWeight += w;
    }

    vec3 color = totalWeight > 0.0 ? accum / totalWeight : vec3(0.95);
    float vign = 1.0 - smoothstep(0.6, 0.9, length(centered));
    color *= mix(0.98, 1.02, vign);
    color += g * u_grainAmount;
    gl_FragColor = vec4(color, 1.0);
}
