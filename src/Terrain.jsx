
import TerrainChunk from './TerrainChunk'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
const PLANE_SIZE = 100
const CHUNK_SIZE = 10

export default function Terrain() {
    const grassTexture = useTexture('./grass.jpg')
    const cloudTexture = useTexture('./cloud.jpg')

    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping
    cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping
    grassTexture.repeat.set(32, 32)
    cloudTexture.repeat.set(32, 32)


    const terrainVertexShader = `
        varying vec2 vUv;
        varying vec2 cloudUV;
        varying vec3 vColor;
        uniform float iTime;

        void main() {
            vUv = uv;
            cloudUV = uv;
            // cloudUV.x += iTime / 300.0;
            // cloudUV.y += iTime / 200.0;
            vColor = vec3(0.5);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `

    const terrainFragmentShader = `
        uniform sampler2D textures[2];
        uniform float iTime;

        varying vec2 vUv;
        varying vec2 cloudUV;
        varying vec3 vColor;

        void main() {
            float contrast = 1.5;
            float brightness = 0.1;
            vec3 color = vec3(0.3, 0.5, 0.2) * contrast;
            // vec3 color = texture2D(textures[0], vUv / 10.).rgb * contrast;
            color = color + vec3(brightness, brightness, brightness);
            // color = mix(color, texture2D(textures[1], cloudUV / 1.5).rgb, 0.5);
            gl_FragColor = vec4(color, 1.0);
        }
    `

    const uniforms = useMemo(() => ({
        textures: { value: [grassTexture, cloudTexture] },
        iTime: { value: 0.0 },
      }), [grassTexture, cloudTexture])

    useFrame((state, delta) => {
        uniforms.iTime.value = state.clock.elapsedTime
    })

    const material = useMemo(() => new THREE.ShaderMaterial({
        uniforms,
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true
      }), [uniforms])

    return (
        <group>
            {Array.from({ length: Math.ceil(PLANE_SIZE / CHUNK_SIZE) }, (_, i) => (
                Array.from({ length: Math.ceil(PLANE_SIZE / CHUNK_SIZE) }, (_, j) => (
                    <TerrainChunk 
                        key={`${i}-${j}`}
                        x={i}
                        z={j}
                        offsetX={i * CHUNK_SIZE}
                        offsetZ={j * CHUNK_SIZE}
                        chunkSize={CHUNK_SIZE}
                        material={material}
                    />
                ))
            ))}
        </group>
    )
}