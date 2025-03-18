import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, HeightfieldCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useMemo } from 'react'
import { saveTerrainData, getTerrainData } from './utils/indexedDB'
import GrassField from './GrassField'
import { useTexture } from '@react-three/drei'
import noise from './utils/noise'

export default function Terrain() {
    const grassTexture = useTexture('./grass.jpg')
    const cloudTexture = useTexture('./cloud.jpg')
    const [terrainData, setTerrainData] = useState(null)
    const meshRef = useRef()
    console.log("render Terrain")
    
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
            vec3 color = texture2D(textures[0], vUv / 2.5).rgb * contrast;
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
        if (meshRef.current) {
            uniforms.iTime.value = state.clock.elapsedTime
        }
    })

    const material = useMemo(() => new THREE.ShaderMaterial({
        uniforms,
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true
      }), [uniforms])

    

    useEffect(() => {
        const initTerrain = async () => {
            const searchParams = new URLSearchParams(window.location.search)
            const clearData = searchParams.get('clear')

            if (clearData) {
                // Générer un nouveau terrain
                generateNewTerrain()
                return
            }

            // Essayer de récupérer les données existantes
            const savedData = await getTerrainData()
            if (savedData) {
                console.log("savedData.vertices", savedData.vertices)
                // Recréer la géométrie à partir des données sauvegardées
                const geometry = new THREE.BufferGeometry()
                geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(savedData.vertices), 3))
                geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(savedData.uvs), 2))
                geometry.setIndex(savedData.indices)
                geometry.computeVertexNormals()

                setTerrainData({
                    heights: new Float32Array(savedData.heights),
                    geometry,
                    scale: savedData.scale,
                    nsubdivs: savedData.nsubdivs,
                    noise
                })
            } else {
                // Générer un nouveau terrain
                console.log("generateNewTerrain")
                generateNewTerrain()
            }
        }

        const generateNewTerrain = () => {
            const nsubdivs = 40
            const scale = { x: 100, y: 1.5, z: 100 }
            
            const heights = new Float32Array((nsubdivs + 1) * (nsubdivs + 1))
            const vertices = new Float32Array((nsubdivs + 1) * (nsubdivs + 1) * 3)
            const uvs = new Float32Array((nsubdivs + 1) * (nsubdivs + 1) * 2)
            
            // Générer les hauteurs et les UVs
            for(let i = 0; i <= nsubdivs; i++) {
                for(let j = 0; j <= nsubdivs; j++) {
                    const x = j / nsubdivs
                    const z = i / nsubdivs
                    
                    const nx = x * Math.PI * 2
                    const nz = z * Math.PI * 2
                    const height = noise(nx, nz)
                    
                    const heightIndex = j * (nsubdivs + 1) + i
                    heights[heightIndex] = height

                    const vertexIndex = (i * (nsubdivs + 1) + j) * 3
                    vertices[vertexIndex] = (j / nsubdivs - 0.5) * scale.x
                    vertices[vertexIndex + 1] = height * scale.y
                    vertices[vertexIndex + 2] = (i / nsubdivs - 0.5) * scale.z

                    const uvIndex = (i * (nsubdivs + 1) + j) * 2
                    uvs[uvIndex] = x
                    uvs[uvIndex + 1] = z
                }
            }

            // Créer les faces
            const indices = []
            for(let i = 0; i < nsubdivs; i++) {
                for(let j = 0; j < nsubdivs; j++) {
                    const a = i * (nsubdivs + 1) + j
                    const b = a + 1
                    const c = (i + 1) * (nsubdivs + 1) + j
                    const d = c + 1

                    indices.push(a, c, b)
                    indices.push(b, c, d)
                }
            }

            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
            geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
            geometry.setIndex(indices)
            geometry.computeVertexNormals()

            const newTerrainData = {
                heights: Array.from(heights),
                vertices: Array.from(vertices),
                uvs: Array.from(uvs),
                indices,
                scale,
                nsubdivs
            }

            // Sauvegarder les données dans IndexedDB
            saveTerrainData(newTerrainData)

            setTerrainData({
                heights,
                geometry,
                scale,
                nsubdivs,
                noise
            })
        }

        initTerrain()
    }, [])

    if (!terrainData) return null

    return (
        <RigidBody type="fixed" colliders={false} friction={1}>
            <mesh receiveShadow ref={meshRef} material={material}>
                <primitive object={terrainData.geometry} />
                {/* <shaderMaterial 
                    // ref={materialRef}
                    vertexShader={terrainVertexShader}
                    fragmentShader={terrainFragmentShader}
                    uniforms={{
                        textures: { value: [grassTexture, cloudTexture] },
                        iTime: { value: iTime }
                    }}
                /> */}
            </mesh>
            <HeightfieldCollider 
                args={[40, 40, terrainData.heights, terrainData.scale]}
                restitution={0.2}
            />
            <GrassField terrainData={terrainData}  />
        </RigidBody>
    )
}