export const GLSL = {
    RANDOM: /*glsl*/ `
        float random (vec2 st) {
            return fract(sin(dot(st.xy,
                                    vec2(12.9898,78.233)))*
                        43758.5453123);
        }
    `,
    LUMA: /*glsl*/ `
        float luma(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
        }
    `,
    QUANTIZE: /*glsl*/ `
        float quantize(float value, int quant) {
            return floor(value * (float(quant) - 1.0) + 0.5) / (float(quant) - 1.0);
        }
    `,
    MAP_RANGE: /*glsl*/ `
        float mapRange(float inMin, float inMax, float value, float outMin, float outMax) {
            return (value - inMin) / (inMax - inMin) * (outMax - outMin) + outMin;
        }

        vec2 mapRange(vec2 inMin, vec2 inMax, vec2 value, vec2 outMin, vec2 outMax) {
            return (value - inMin) / (inMax - inMin) * (outMax - outMin) + outMin;
        }
    `,
    BLEND_NORMAL: /*glsl*/ `
        vec3 blendNormal(vec3 base, vec3 blend) {
            return blend;
        }

        vec3 blendNormal(vec3 base, vec3 blend, float opacity) {
            return (blendNormal(base, blend) * opacity + base * (1.0 - opacity));
        }
    `,
}
