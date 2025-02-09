import './style.css'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience.jsx'
import * as THREE from 'three'
import { Suspense, useState } from 'react'
import LoadingScreen from './LoadingScreen'

function App() {
    const [started, setStarted] = useState(false)

    return (
        <>
            <LoadingScreen started={started} onStarted={() => setStarted(true)} />
            <Canvas
                className="r3f"
                onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping }}
                camera={ {
                    fov: 45,
                    near: 0.1,
                    far: 2000,
                    position: [ -3, 1.5, 4 ]
                } }
            >
                <Suspense fallback={null}>
                    <Experience />
                </Suspense>
            </Canvas>
        </>
    )
}

const root = ReactDOM.createRoot(document.querySelector('#root'))
root.render(<App />)