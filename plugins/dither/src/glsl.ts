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
    GREYSCALE: /*glsl*/ `
        float grayscale(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
        }
    `,
    QUANTIZE: /*glsl*/ `
        float quantize(float value, int quant) {
            return floor(value * (float(quant) - 1.0) + 0.5) / (float(quant) - 1.0);
        }
    `,
}
