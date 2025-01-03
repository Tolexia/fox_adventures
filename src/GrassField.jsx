import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'

const fragmentShader = `
uniform sampler2D textures[2];
uniform vec3 foxPosition;
uniform float iTime;

varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;

void main() {
  float contrast = 1.5;
  float brightness = 0.1;

  // Animation de la texture d'herbe
  vec2 animatedUV = vUv;

  vec3 color = texture2D(textures[0], animatedUV / 2.5).rgb * contrast;
  color = color + vec3(brightness, brightness, brightness);
//   color = mix(color, texture2D(textures[1], cloudUV / 1.5).rgb, 0.3);
  
  // Détection des bords latéraux uniquement
  float edgeLeft = smoothstep(0.0, 0.7, vColor.r);
  float edgeRight = smoothstep(0.3, 1.0, vColor.r);
  float isEdge = max(1.0 - edgeLeft, edgeRight);
  
  // Préservation de la base
  float heightGradient = smoothstep(0.0, 1.0, vColor.g);
  
  // Assombrissement final
  float darknessAlpha = 0.05;
  float darkness = isEdge * darknessAlpha * heightGradient;
  color -= darkness;
  
  float alpha = 1.0;
  gl_FragColor = vec4(color, alpha);
}
`

const vertexShader = `
varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;
uniform float iTime;
uniform vec3 foxPosition;

void main() {
  vUv = uv;
  cloudUV = uv;
  cloudUV.x += iTime / 300.0;
  cloudUV.y += iTime / 200.0;
  vColor = color;
  vec3 cpos = position;

  float waveSize = 5.0;
  float tipDistance = 0.2;
  float centerDistance = 0.1;
  float waveFrequency = 1500.0;

  if (color.x > 0.6) {
    cpos.x += sin((iTime / waveFrequency) + (uv.x * waveSize)) * tipDistance;
  } else if (color.x > 0.0) {
    cpos.x += sin((iTime / waveFrequency) + (uv.x * waveSize)) * centerDistance;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(cpos, 1.0);
}
`

const PLANE_SIZE = 100
const BLADE_COUNT = 1000000
const BLADE_WIDTH = .1
const BLADE_HEIGHT = 0.17
const BLADE_HEIGHT_VARIATION = 0.15

function convertRange(val, oldMin, oldMax, newMin, newMax) {
  return (((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin)) + newMin
}

function generateBlade(center, vArrOffset, uv) {
  const MID_WIDTH = BLADE_WIDTH * 0.5
  const TIP_OFFSET = 0.1
  const height = BLADE_HEIGHT + (Math.random() * BLADE_HEIGHT_VARIATION)

  const distanceFromCenter = Math.sqrt(center.x * center.x + center.z * center.z)
  const rotationBias = Math.atan2(center.z, center.x)
  const yaw = rotationBias + (Math.random() - 0.5) * Math.PI * 0.5
  const yawUnitVec = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw))
  const tipBend = yaw + (Math.random() - 0.5) * Math.PI * 0.25
  const tipBendUnitVec = new THREE.Vector3(Math.sin(tipBend), 0, -Math.cos(tipBend))

  const bl = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((BLADE_WIDTH / 2) * 1))
  const br = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((BLADE_WIDTH / 2) * -1))
  const tl = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((MID_WIDTH / 2) * 1))
  const tr = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((MID_WIDTH / 2) * -1))
  const tc = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(tipBendUnitVec).multiplyScalar(TIP_OFFSET))

  tl.y += height / 2
  tr.y += height / 2
  tc.y += height

  const black = [0, 0, 0]
  const gray = [0.5, 0.5, 0.5]
  const white = [1.0, 1.0, 1.0]

  const verts = [
    { pos: bl.toArray(), uv: uv, color: black },
    { pos: br.toArray(), uv: uv, color: black },
    { pos: tr.toArray(), uv: uv, color: gray },
    { pos: tl.toArray(), uv: uv, color: gray },
    { pos: tc.toArray(), uv: uv, color: white }
  ]

  const indices = [
    vArrOffset,
    vArrOffset + 1,
    vArrOffset + 2,
    vArrOffset + 2,
    vArrOffset + 4,
    vArrOffset + 3,
    vArrOffset + 3,
    vArrOffset,
    vArrOffset + 2
  ]

  return { verts, indices }
}

export default function GrassField({ terrainData, foxPosition }) {
  const meshRef = useRef()
  const startTime = useRef(Date.now())

  const grassTexture = useTexture('/grass.jpg')
  const cloudTexture = useTexture('/cloud.jpg')
  
  cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping

  const getTerrainHeight = (x, z) => {
    if (!terrainData) return 0

    // Convertir les coordonnées mondiales en coordonnées de la grille du terrain
    const gridX = Math.max(0, Math.min(terrainData.nsubdivs, ((x / terrainData.scale.x) + 0.5) * terrainData.nsubdivs))
    const gridZ = Math.max(0, Math.min(terrainData.nsubdivs, ((z / terrainData.scale.z) + 0.5) * terrainData.nsubdivs))

    // Obtenir les indices des points de la grille les plus proches
    const x0 = Math.floor(gridX)
    const z0 = Math.floor(gridZ)
    const x1 = Math.min(x0 + 1, terrainData.nsubdivs)
    const z1 = Math.min(z0 + 1, terrainData.nsubdivs)

    // Calculer les poids pour l'interpolation bilinéaire
    const wx = gridX - x0
    const wz = gridZ - z0

    // Obtenir les hauteurs aux quatre coins
    const h00 = terrainData.heights[x0 * (terrainData.nsubdivs + 1) + z0] * terrainData.scale.y
    const h10 = terrainData.heights[x1 * (terrainData.nsubdivs + 1) + z0] * terrainData.scale.y
    const h01 = terrainData.heights[x0 * (terrainData.nsubdivs + 1) + z1] * terrainData.scale.y
    const h11 = terrainData.heights[x1 * (terrainData.nsubdivs + 1) + z1] * terrainData.scale.y

    // Interpolation bilinéaire
    const h0 = h00 * (1 - wx) + h10 * wx
    const h1 = h01 * (1 - wx) + h11 * wx
    return h0 * (1 - wz) + h1 * wz
  }

  const uniforms = useMemo(() => ({
    textures: { value: [grassTexture, cloudTexture] },
    iTime: { value: 0.0 },
    foxPosition: { value: new THREE.Vector3(...foxPosition) }
  }), [grassTexture, cloudTexture])

  useFrame((state, delta) => {
    if (meshRef.current) {
    //   uniforms.iTime.value = state.clock.elapsedTime
        uniforms.iTime.value = Date.now() - startTime.current
        uniforms.foxPosition.value.set(...foxPosition)
    }
  })

  const geometry = useMemo(() => {
    if (!terrainData) return null

    const positions = []
    const uvs = []
    const indices = []
    const colors = []

    // Distribution uniforme avec bruit pour éviter la régularité
    const gridSize = Math.sqrt(BLADE_COUNT)
    const cellSize = PLANE_SIZE / gridSize

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // Position de base sur la grille
        const baseX = (i / gridSize - 0.5) * PLANE_SIZE
        const baseZ = (j / gridSize - 0.5) * PLANE_SIZE

        // Ajout d'un décalage aléatoire pour éviter l'aspect grille
        const offsetX = (Math.random() - 0.5) * cellSize * 0.8
        const offsetZ = (Math.random() - 0.5) * cellSize * 0.8

        const x = baseX + offsetX
        const z = baseZ + offsetZ

        // Vérifier que nous sommes dans les limites du terrain
        if (Math.abs(x) <= PLANE_SIZE / 2 && Math.abs(z) <= PLANE_SIZE / 2) {
          const y = getTerrainHeight(x, z)
          const pos = new THREE.Vector3(x, y, z)

          const uv = [
            convertRange(x, -PLANE_SIZE * 0.5, PLANE_SIZE * 0.5, 0, 1),
            convertRange(z, -PLANE_SIZE * 0.5, PLANE_SIZE * 0.5, 0, 1)
          ]

          const blade = generateBlade(pos, positions.length / 3, uv)
          blade.verts.forEach(vert => {
            positions.push(...vert.pos)
            uvs.push(...vert.uv)
            colors.push(...vert.color)
          })
          blade.indices.forEach(indice => indices.push(indice))
        }
      }
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
    geom.setIndex(indices)
    geom.computeVertexNormals()

    return geom
  }, [terrainData])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true
  }), [uniforms])

  if (!terrainData) return null

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  )
} 