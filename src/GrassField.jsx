import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTexture, Html } from '@react-three/drei'
import useLoadingStore from './stores/useLoadingStore'

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
  float darknessAlpha = 0.08;
  float darkness = isEdge * darknessAlpha * heightGradient;
  color -= (darkness * 0.9);
  
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
  float centerDistance = 0.05;
  float waveFrequency = 1500.0;

  // Calcul de la distance au renard
  float foxRadius = 0.5; // Rayon d'influence du renard
  float foxStrength = 0.2; // Force de l'effet
  vec3 toFox = foxPosition - position;
  float distanceToFox = length(toFox);
  
  // Calcul du vecteur d'écartement
  if (distanceToFox < foxRadius) {
    float pushStrength = (1.0 - distanceToFox / foxRadius) * foxStrength;
    // Plus fort sur la pointe de l'herbe (utilisation de vColor.g pour la hauteur)
    pushStrength *= smoothstep(0.0, 1.0, vColor.g);
    // Direction opposée au renard, normalisée et appliquée sur X et Z
    vec3 pushDir = normalize(vec3(toFox.x, 0.0, toFox.z));
    cpos.xz -= pushDir.xz * pushStrength;
  }
  // Animation de base de l'herbe
  else if (color.x > 0.6) {
    cpos.x += sin((iTime / waveFrequency) + (uv.x * waveSize)) * tipDistance;
  } else if (color.x > 0.0) {
    cpos.x += sin((iTime / waveFrequency) + (uv.x * waveSize)) * centerDistance;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(cpos, 1.0);
}
`

const PLANE_SIZE = 100
const BLADE_COUNT = 1000000
const BLADE_WIDTH = .07
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
  const workerRef = useRef()
  const [geometry, setGeometry] = useState(null)
  const [progress, setProgress] = useState(0)
  const setGrassLoaded = useLoadingStore((state) => state.setGrassLoaded)

  const grassTexture = useTexture('./grass.jpg')
  const cloudTexture = useTexture('./cloud.jpg')
  
  cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping

  useEffect(() => {
    workerRef.current = new Worker(new URL('./utils/terrainWorker.js', import.meta.url))

    workerRef.current.onmessage = (event) => {
      const { type, data } = event.data
      switch (type) {
        case 'grassGeometry':
          const geom = new THREE.BufferGeometry()
          geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.positions), 3))
          geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(data.uvs), 2))
          geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(data.colors), 3))
          geom.setIndex(data.indices)
          geom.computeVertexNormals()
          geom.computeBoundingSphere()
          setGeometry(geom)
          setProgress(100)
          setGrassLoaded(true)
          break

        case 'progress':
          setProgress(data)
          break
      }
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [setGrassLoaded])

  useEffect(() => {
    if (!terrainData) return

    // Envoyer les données nécessaires au Worker
    const heightData = {
      heights: Array.from(terrainData.heights),
      scale: terrainData.scale,
      nsubdivs: terrainData.nsubdivs
    }

    workerRef.current.postMessage({
      type: 'generateGrass',
      data: { terrainData: heightData }
    })
  }, [terrainData])

  const uniforms = useMemo(() => ({
    textures: { value: [grassTexture, cloudTexture] },
    iTime: { value: 0.0 },
    foxPosition: { value: new THREE.Vector3(...foxPosition) }
  }), [grassTexture, cloudTexture])

  useFrame((state, delta) => {
    if (meshRef.current) {
      uniforms.iTime.value = Date.now() - startTime.current
      uniforms.foxPosition.value.set(...foxPosition)
    }
  })

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true
  }), [uniforms])

  if (!terrainData) return null

  if (!geometry) {
    return null
  }

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  )
} 