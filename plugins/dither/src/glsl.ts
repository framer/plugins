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
}
