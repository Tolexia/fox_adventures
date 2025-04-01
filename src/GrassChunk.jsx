import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTexture, Detailed } from '@react-three/drei'
import useGame from './utils/useGame'
// import { Text } from '@react-three/drei'

const fragmentShader = `
uniform sampler2D textures[2];
uniform vec3 foxPosition;
uniform float iTime;

varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;
varying vec3 vPos;
varying vec3 worldPos;

void main() {
  float contrast = 1.5;
  float brightness = 0.1;

  // Animation de la texture d'herbe
  vec2 animatedUV = vUv;

//   vec3 color = vColor ;
  vec3 color = vec3(0.3, 0.5, 0.2) * contrast;
//   vec3 color = texture2D(textures[0], animatedUV / 10.).rgb * contrast;
  color = color + vec3(brightness, brightness, brightness);
//   color = mix(color, texture2D(textures[1], cloudUV / 1.5).rgb, 0.3);
  
  // Détection des bords latéraux uniquement
  float edgeLeft = smoothstep(0.5, 1., vColor.b);
  float edgeRight = smoothstep(0.5, 1.0, vColor.r);
  float isEdge = max(1.0 - edgeLeft, edgeRight);
  
  // Préservation de la base
  float heightGradient = smoothstep(0.0, 1.0, vColor.g);
  
  // Assombrissement final
  float darknessAlpha = 0.08;
  float darkness = isEdge * darknessAlpha * heightGradient * vPos.y;
  color -= (darkness * 0.8);

  // Debug fox position
//   vec2 toFox = foxPosition.xz - worldPos.xz;
//   float distanceToFox = length(toFox);
//   color = mix(color, vec3(0.8, 0.2, 0.2), smoothstep(5.0, 0.0, distanceToFox));
  
  float alpha = 1.0;
  gl_FragColor = vec4(color, alpha);
}
`

const vertexShader = `
varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;
varying vec3 vPos;
varying vec3 worldPos;
uniform float iTime;
uniform vec3 foxPosition;
uniform float offsetX;
uniform float offsetZ;
uniform float chunkSize;

void main() {
  vUv = uv;
  cloudUV = uv;
  cloudUV.x += iTime / 300.0;
  cloudUV.y += iTime / 200.0;
  vColor = color;
  vec3 cpos = position;

  float waveSize = 10.;
  float tipDistance = 0.2;
  float centerDistance = 0.05;
  float waveFrequency = 1500.0;

  worldPos = position;
  worldPos.x = position.x + offsetX;
  worldPos.z = position.z + offsetZ;

  // Calcul de la distance au renard
  float foxRadius = 0.5; // Rayon d'influence du renard
  float foxStrength = 0.15; // Force de l'effet
  vec2 toFox = foxPosition.xz - worldPos.xz;
  float distanceToFox = length(toFox);
  
  // Calcul du vecteur d'écartement

  // Animation de base de l'herbe
  if (color.y > 0.) {
    cpos.x += sin((iTime / waveFrequency) + (uv.x * waveSize)) * tipDistance * pow(cpos.y, 5.);
    // cpos.z += sin((iTime / waveFrequency) + (uv.x * waveSize)) * tipDistance * pow(cpos.y, 2.);
  } 
    else if (color.x > 0.0) {
    cpos.x += sin((iTime / waveFrequency) + (uv.x * waveSize)) * centerDistance;
  }

  if (distanceToFox < foxRadius) {
    float pushStrength = (1.0 - distanceToFox / foxRadius) * foxStrength;
    // Plus fort sur la pointe de l'herbe (utilisation de vColor.g pour la hauteur)
    // pushStrength *= smoothstep(0.0, 1.0, vColor.g);
    // Direction opposée au renard, normalisée et appliquée sur X et Z
    vec2 pushDir = normalize(toFox);
    cpos.xz -= pushDir * pushStrength;
  }

  vPos = cpos;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(cpos, 1.0);
}
`

// const BLADE_COUNT = 10000
const BLADE_WIDTH = .07
const BLADE_HEIGHT = 0.17
const BLADE_HEIGHT_VARIATION = 0.15

const LOD_LEVELS = {
  HIGH: {
    distance: 20,
    bladeCount: 10000,
    material: "shader"
  },
  MEDIUM: {
    distance: 50,
    bladeCount: 1000,
    material: "shader"
  },
  LOW: {
    distance: 100,
    bladeCount: 0,
    material: "basic"
  }
}

function convertRange(val, oldMin, oldMax, newMin, newMax) {
  return (((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin)) + newMin
}

function generateBlade(center, vArrOffset, uv) {
  const MID_WIDTH = BLADE_WIDTH * 0.5
  const TIP_OFFSET = 0.0
  const height = BLADE_HEIGHT + (Math.random() * BLADE_HEIGHT_VARIATION)

  const distanceFromCenter = Math.sqrt(center.x * center.x + center.z * center.z)
  const rotationBias = Math.atan2(center.z, center.x)
//   const yaw = rotationBias + (0.25) * Math.PI * 0.5
  const yaw = 1
  const yawUnitVec = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw))
  const tipBend = yaw + (0.25) * Math.PI * 0.25
  const tipBendUnitVec = new THREE.Vector3(Math.sin(tipBend), 0, -Math.cos(tipBend))

  const placement = Math.random()

  const bl = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((BLADE_WIDTH / 2) * placement))
  const br = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((BLADE_WIDTH / 2) * -placement))
  const tl = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((MID_WIDTH / 2) * placement))
  const tr = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((MID_WIDTH / 2) * -placement))
  const tc = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(tipBendUnitVec).multiplyScalar(TIP_OFFSET))
  const bc = new THREE.Vector3().addVectors(center, new THREE.Vector3().copy(yawUnitVec).multiplyScalar((MID_WIDTH / 2)))

  tl.y += height / 2
  tr.y += height / 2
  tc.y += height
  bc.y = 0

  // left : blue
  // right : red
  // top : white
  // bottom : black
  // base doit avoir green = 0 pour ne pas bouger dans vertexShader

  const black = [0, 0, 0]
  const gray = [0.5, 0.5, 0.5]
  const white = [1.0, 1.0, 1.0]
  const red = [1.0, 0.0, 0.0]

  const verts = [
    { pos: bl.toArray(), uv: uv, color: [0.0, 0.0, 1.0] },
    { pos: br.toArray(), uv: uv, color: [1.0, 0.0, 0.0] },
    { pos: tr.toArray(), uv: uv, color: [1.0, 0.5, 0.5] },
    { pos: tl.toArray(), uv: uv, color: [0.5, 0.5, 1.0] },
    { pos: tc.toArray(), uv: uv, color: [1.0, 1.0, 1.0] },
    // { pos: bc.toArray(), uv: uv, color: black },
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

export default function GrassChunk({ terrainData, offsetX, offsetZ, chunkSize, planeSize }) {
  const meshRef = useRef()
  const startTime = useRef(Date.now())
  const foxPosition = useGame((state) => state.foxPosition)
  const CHUNK_SIZE = chunkSize
  const PLANE_SIZE = planeSize

  // Position du chunk avec le même décalage que le terrain

  const grassTexture = useTexture('./grass.jpg')
  const cloudTexture = useTexture('./cloud.jpg')
  
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

    const uniforms = {
        textures: { value: [grassTexture, cloudTexture] },
        iTime: { value: 0.0 },
        offsetX: { value: offsetX },
        offsetZ: { value: offsetZ },
        chunkSize: { value: CHUNK_SIZE },
        foxPosition: { value: new THREE.Vector3(...foxPosition) }
    }

    const refs = []
    Object.keys(LOD_LEVELS).forEach(key => {
      refs.push(useRef())
    })
    
  useFrame((state, delta) => {
      const storedFoxPosition = localStorage.getItem('foxPosition')
      const foxPos = JSON.parse(storedFoxPosition)
    if (meshRef.current) {
    //   uniforms.iTime.value = state.clock.elapsedTime
        // uniforms.iTime.value = Date.now() - startTime.current
        // meshRef.current.material.uniforms.foxPosition.value = new THREE.Vector3(...foxPos)
        // material.uniforms.foxPosition.value = new THREE.Vector3(...foxPos)
    }
    refs.forEach(ref => {
        if(!ref.current || !ref.current.material) return
        // console.log("ref", ref.current.material)
        if(ref.current.material.uniforms) {
            ref.current.material.uniforms.foxPosition.value = new THREE.Vector3(...foxPos)
            ref.current.material.uniforms.iTime.value = Date.now() - startTime.current
        }
    })
  })
  let minDistanceToFox = 9999999

  const getGeometry = (BLADE_COUNT) => {
    if (!terrainData) return null

    const positions = []
    const worldPositions = []
    const uvs = []
    const indices = []
    const colors = []

    // Distribution uniforme avec bruit pour éviter la régularité
    const gridSize = Math.sqrt(BLADE_COUNT)
    const cellSize = CHUNK_SIZE / gridSize

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // Position de base sur la grille
        const baseX = (i / gridSize - 0.5) * CHUNK_SIZE
        const baseZ = (j / gridSize - 0.5) * CHUNK_SIZE

        // Ajout d'un décalage aléatoire pour éviter l'aspect grille
        const randomOffsetX = (Math.random() - 0.5) * cellSize * 0.8
        const randomOffsetZ = (Math.random() - 0.5) * cellSize * 0.8

        const x = baseX + randomOffsetX
        const z = baseZ + randomOffsetZ


        // Vérifier que nous sommes dans les limites du terrain
        if (Math.abs(x) <= CHUNK_SIZE / 2 && Math.abs(z) <= CHUNK_SIZE / 2) {
        //   const y = 0
          const y = getTerrainHeight(x, z)
          const pos = new THREE.Vector3(x, y, z)

          const uv = [
            convertRange(x, -CHUNK_SIZE * 0.5, CHUNK_SIZE * 0.5, 0, 1),
            convertRange(z, -CHUNK_SIZE * 0.5, CHUNK_SIZE * 0.5, 0, 1)
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
  }
  const geometry = useMemo(() => {
    if (!terrainData) return null

    const geometries = []
    Object.keys(LOD_LEVELS).forEach(level => {
      const { bladeCount } = LOD_LEVELS[level]
      const geom = getGeometry(bladeCount)
      geometries.push(geom)
    })

    return geometries
  }, [terrainData])

//   console.log("geometry", geometry)
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true
  })
  const basicMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.55, 0.85, 0.45),
    transparent: true
  })

  if (!terrainData) return null

  const incrementLoadedChunks = useGame((state) => state.incrementLoadedChunks)
   // Signaler que ce chunk est chargé
//    useEffect(() => {
    setTimeout(() => {
        incrementLoadedChunks()
        console.log("incrementLoadedChunks")
    }, 10)
    // }, [])

  return (
    // <></>
    <Detailed distances={[...Object.keys(LOD_LEVELS).map(key => LOD_LEVELS[key].distance)]} >
        {Object.keys(LOD_LEVELS).map((key, index) => (
            <mesh key={key} ref={refs[index]} geometry={geometry[index]} material={LOD_LEVELS[key].material === "shader" ? material : basicMaterial}/>
        ))}
    </Detailed>
    //   <mesh ref={meshRef} geometry={geometry} material={material}/>
  )
} 