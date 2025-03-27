import { useRef, useState, useEffect } from 'react'
import { RigidBody, HeightfieldCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { saveTerrainData, getTerrainData } from './utils/indexedDB'
import GrassField from './GrassField'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import noise from './utils/noise'
import GrassChunk from './GrassChunk'

const PLANE_SIZE = 100
const CHUNK_SIZE = 10

export default function TerrainChunk({ x, z,offsetX, offsetZ, chunkSize, material }) {

    const [terrainData, setTerrainData] = useState(null)
    const meshRef = useRef()
    console.log("render terrainChunk")
    

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
            const savedData = await getTerrainData(x,z)
            if (savedData) {
                // console.log("savedData.vertices", savedData.vertices)
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
            console.log("generateNewTerrain function")
            const nsubdivs = 10
            const scale = { x: CHUNK_SIZE, y: 1.5, z: CHUNK_SIZE }
            
            const heights = new Float32Array((nsubdivs + 1) * (nsubdivs + 1))
            const vertices = new Float32Array((nsubdivs + 1) * (nsubdivs + 1) * 3)
            const uvs = new Float32Array((nsubdivs + 1) * (nsubdivs + 1) * 2)
            
            // Générer les hauteurs et les UVs
            for(let i = 0; i <= nsubdivs; i++) {
                for(let j = 0; j <= nsubdivs; j++) {
                    const x = j / nsubdivs
                    const z = i / nsubdivs
                    
                    const worldX = (x + offsetX / CHUNK_SIZE) 
                    const worldZ = (z + offsetZ / CHUNK_SIZE)
                    const height = noise(worldX, worldZ) / 2
                    
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
            saveTerrainData(x,z,newTerrainData)

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
        <group position={[offsetX, 0, offsetZ]}>
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
                    args={[CHUNK_SIZE, CHUNK_SIZE, terrainData.heights, terrainData.scale]}
                    restitution={0.2}
                />
                <GrassChunk terrainData={terrainData} chunkSize={CHUNK_SIZE} planeSize={PLANE_SIZE} offsetX={offsetX} offsetZ={offsetZ} />
            </RigidBody>
        </group>
    )
}