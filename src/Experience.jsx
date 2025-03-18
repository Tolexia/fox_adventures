import { useRef } from 'react'
import { OrbitControls, Sky } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'
import Fox from './Fox'
import Terrain from './Terrain'


export default function Experience() {
    const orbitControlsRef = useRef()
    
    const sunPosition = new THREE.Vector3(1, 2, 3)

    return (
        <>
            <Physics
            // debug
             gravity={[0, -9.81, 0]}
             >
                <Terrain />
                <Fox 
                    orbitControlsRef={orbitControlsRef}
                />
            </Physics>

            <directionalLight 
                position={[5, 5, 5]} 
                intensity={1.8} 
                castShadow 
                shadow-mapSize={[1024, 1024]}
            />
            <Sky sunPosition={ sunPosition } />
            <ambientLight intensity={2.4} />
            <OrbitControls 
                ref={orbitControlsRef}
                minDistance={1}
                maxDistance={4}
                maxPolarAngle={Math.PI / 2.5}
                minPolarAngle={Math.PI / 2.5}
                enablePan={false}
                enableZoom={true}
                enableDamping={true}
                dampingFactor={0.05}
                zoomSpeed={0.5}
                rotateSpeed={0.5}
                keyEvents={false}
            />
        </>
    )
}