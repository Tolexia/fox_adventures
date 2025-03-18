import GrassChunk from './GrassChunk'

const PLANE_SIZE = 100
const CHUNK_SIZE = 10

export default function GrassField({ terrainData }) {
 
  if (!terrainData) return null

  return (
    <group position={[CHUNK_SIZE / 2, 1, CHUNK_SIZE / 2]}>
       {Array.from({ length: Math.ceil(PLANE_SIZE / CHUNK_SIZE) }, (_, i) => (
        Array.from({ length: Math.ceil(PLANE_SIZE / CHUNK_SIZE) }, (_, j) => (
          <GrassChunk key={`${i}-${j}`} terrainData={terrainData} offsetX={i * CHUNK_SIZE} offsetZ={j * CHUNK_SIZE} />
        ))
       ))}
    </group>
  )
} 