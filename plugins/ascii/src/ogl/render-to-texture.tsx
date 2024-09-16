import {
    Camera,
    GLTF,
    GLTFDescription,
    GLTFLoader,
    Mesh,
    OGLRenderingContext,
    Orbit,
    Program,
    Renderer,
    RenderTarget,
    Transform,
    Vec3,
} from "ogl"
import { useCallback, useState, useRef } from "react"

// Set up basic shaders
const vertexShader = /*glsl*/ `
in vec3 position;
in vec3 normal;

out vec2 vUv;
out vec3 vNormal;
out vec3 vMPos;

#ifdef UV
  attribute vec2 uv;
#else
  const vec2 uv = vec2(0);   
#endif  

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
uniform mat3 normalMatrix;

void main() {
  vec4 pos = vec4(position, 1);
  vec4 mPos = modelMatrix * pos;
  vMPos = mPos.xyz / mPos.w;

  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * pos;
}
`

const fragmentShader = /*glsl*/ `
in vec3 vNormal;
in vec3 vMPos;

#ifdef USECOLOR
  bool useColor = true;
#else
  bool useColor = false;
#endif  

uniform vec4 uBaseColorFactor;
uniform vec3 uLightColor;
uniform vec3 uLightDirection;
uniform vec3 cameraPosition;
uniform float uAmbientStrength;
uniform float uSpecularStrength;
uniform float uShininess;

vec3 linearToSRGB(vec3 color) {
  return pow(color, vec3(1.0 / 2.2));
}

vec3 colorLighting(vec3 normalSurface, vec3 viewDir, vec3 lightDir) {
  // Ambient lighting
  vec3 ambient = uAmbientStrength * uLightColor;

  // Diffuse lighting
  vec3 diffuseLighting = clamp(dot(normalSurface, lightDir), 0.001, 1.0) * uLightColor;

  // Specular highlights (Blinn-Phong)
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(viewDir, halfDir), 0.0), uShininess);
  vec3 specular = uSpecularStrength * spec * uLightColor;

  return ambient + diffuseLighting + specular;
}

void main() {
  vec4 color = uBaseColorFactor;
  vec3 normalSurface = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vMPos);
  vec3 lightDir = normalize(uLightDirection);

  if (useColor) {
    color.rgb = colorLighting(normalSurface, viewDir, lightDir);
  } else {
    color.rgb = linearToSRGB(normalSurface);
  }

  gl_FragColor = color;
  gl_FragColor.a = uBaseColorFactor.a;
}
`

function clearModelFromScene(gltf: GLTF | null) {
    if (!gltf) return

    const s = gltf.scene || gltf.scenes[0]
    s.forEach(root => {
        root.setParent(null)
    })
}

export function useOGLFBOPipeline({
    gl,
    resolution,
    renderer,
}: {
    gl: OGLRenderingContext
    resolution: [number, number]
    renderer: Renderer
}) {
    const gltfRef = useRef<GLTF | null>(null)
    const [scene] = useState(() => new Transform())
    const [camera] = useState(() => new Camera(gl, { fov: 35 }))
    camera.position.set(0, 0, 5)
    camera.lookAt([0, 0, 0])

    const [controls] = useState(
        () =>
            new Orbit(camera, {
                target: new Vec3(0, 0, 0),
            })
    )

    const [target] = useState(
        new RenderTarget(gl, {
            width: resolution[0],
            height: resolution[1],
        })
    )

    const createProgram = useCallback(
        (node: Mesh) => {
            const gltf = node.program.gltfMaterial || {}

            const vertexPrefix = renderer.isWebgl2
                ? /* glsl */ `#version 300 es
        #define attribute in
        #define varying out
        #define texture2D texture
        `
                : ``

            const fragmentPrefix = renderer.isWebgl2
                ? /* glsl */ `#version 300 es
        precision highp float;
        #define varying in
        #define texture2D texture
        #define gl_FragColor FragColor
        out vec4 FragColor;
    `
                : /* glsl */ `#extension GL_OES_standard_derivatives : enable
        precision highp float;
    `

            let defines = `
        ${node.geometry.attributes.uv ? `#define UV` : ``}
        ${node.geometry.attributes.normal ? `#define NORMAL` : ``}
        ${node.geometry.isInstanced ? `#define INSTANCED` : ``}
        // #define USECOLOR
        `

            const program = new Program(gl, {
                vertex: vertexPrefix + defines + vertexShader,
                fragment: fragmentPrefix + defines + fragmentShader,
                uniforms: {
                    uBaseColorFactor: { value: gltf?.baseColorFactor || [1, 1, 1, 1] },
                    uLightDirection: { value: new Vec3(0, 1, 1) },
                    uLightColor: { value: new Vec3(1) },
                    uAmbientStrength: { value: 0.1 },
                    uSpecularStrength: { value: 0.1 },
                    uShininess: { value: 16 },
                },
                transparent: gltf?.alphaMode === "BLEND",
                cullFace: gltf?.doubleSided ? false : gl.BACK,
            })

            return program
        },
        [renderer, gl]
    )

    const setGLTF = useCallback(
        (gltf: GLTF) => {
            clearModelFromScene(gltfRef.current)

            const s = gltf.scene || gltf.scenes[0]
            s.forEach(root => {
                // Add model to scene

                root.traverse(node => {
                    if (node.program) {
                        node.program = createProgram(node)
                    }
                })

                root.setParent(scene)
            })

            scene.updateMatrixWorld()
            gltfRef.current = gltf
        },
        [gl, scene]
    )

    const loadModelFromFile = useCallback(
        async (asset: GLTFDescription) => {
            try {
                const gltf = await GLTFLoader.parse(gl, asset, "")

                setGLTF(gltf)
            } catch (e) {
                console.log("Loading model error:", e)
            }
        },
        [gl]
    )

    const loadModelFromSrc = useCallback(
        async (src: string) => {
            try {
                const gltf = await GLTFLoader.load(gl, src)

                setGLTF(gltf)
            } catch (e) {
                console.log("Loading model error:", e)
            }
        },
        [gl]
    )

    const loadModel = useCallback(
        async (asset: GLTFDescription | string) => {
            if (typeof asset === "string") {
                await loadModelFromSrc(asset)
            } else {
                await loadModelFromFile(asset)
            }
        },
        [gl]
    )

    const animate = useCallback(() => {
        if (gltfRef.current && gltfRef.current.animations) {
            gltfRef.current.animations.forEach(({ animation }) => {
                animation.elapsed += 0.01
                animation.update()
            })
        }
    }, [])

    const updateRenderTarget = useCallback(
        ({
            program,
            animateModel = true,
            orbitControls = true,
        }: {
            animateModel?: boolean
            orbitControls?: boolean
            program: Program
        }) => {
            if (orbitControls) {
                controls.update()
            }

            if (animateModel) {
                animate()
            }

            // Render to the framebuffer (off-screen)
            renderer.render({ scene, camera, target, frustumCull: false, sort: false })

            if (target) {
                program.uniforms.uTexture.value = target.texture
            }
        },
        [renderer, scene, camera, target, controls, animate]
    )

    return { updateRenderTarget, loadModelFromSrc, loadModelFromFile, loadModel }
}
