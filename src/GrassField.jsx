import GrassChunk from './GrassChunk'


export default function GrassField({ terrainData, chunkSize, planeSize }) {
 
  if (!terrainData) return null

  // Calculer le décalage pour centrer le champ d'herbe sur le terrain
  const offset = chunkSize/2
  return (
    <group position={[offset, 0, offset]}>
      {Array.from({ length: Math.ceil(planeSize / chunkSize) }, (_, i) => (
        Array.from({ length: Math.ceil(planeSize / chunkSize) }, (_, j) => (
          <GrassChunk 
            key={`${i}-${j}`} 
            terrainData={terrainData} 
            offsetX={i * chunkSize} 
            offsetZ={j * chunkSize} 
            chunkSize={chunkSize} 
            planeSize={planeSize} 
          />
        ))
      ))}
    </group>
  )
} 