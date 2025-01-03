import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, useTexture, Sky } from '@react-three/drei'
import { RigidBody, Physics, CuboidCollider, HeightfieldCollider, useRapier, TrimeshCollider, CylinderCollider, ConvexHullCollider, RoundCuboidCollider, CapsuleCollider, BallCollider, RoundCylinderCollider } from '@react-three/rapier'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { useControls } from 'leva'
import GrassField from './GrassField'
import { useMemo } from 'react'

function Fox({ position = [0, 0, 0], orbitControlsRef, onPositionUpdate }) {
    const fox = useRef()
    const rigidBody = useRef()
    const { scene, animations } = useGLTF('/models/Fox/glTF/Fox.gltf')
    const { actions } = useAnimations(animations, fox)
    const [currentAnimation, setCurrentAnimation] = useState('Survey')
    const { rapier, world } = useRapier()

    // Vecteurs temporaires pour les calculs
    const walkDirection = new THREE.Vector3()
    const [keysPressed, setKeysPressed] = useState({})

    const foxControls = {
        walkVelocity:  2,
        runVelocity:  4,
    }

    useEffect(() => {
        const handleKeyDown = (e) => {
            setKeysPressed(prev => ({ ...prev, [e.code]: true }))
            if (e.code === 'ShiftLeft') {
                setCurrentAnimation(currentAnimation === 'Run' ? 'Walk' : 'Run')
            }
        }

        const handleKeyUp = (e) => {
            setKeysPressed(prev => ({ ...prev, [e.code]: false }))
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [])

    const fadeToAction = (actionName, duration = 0.6) => {
        const current = actions[actionName]
        if (!current) return

        const others = Object.values(actions).filter(action => action !== current)

        // Démarrer la nouvelle animation
        current.reset()
        current.setEffectiveTimeScale(1)
        current.setEffectiveWeight(1)
        current.fadeIn(duration)
        current.play()

        // Arrêter progressivement les autres animations
        others.forEach(action => {
            action.fadeOut(duration)
            action.setEffectiveWeight(0)
        })
    }

    useEffect(() => {
        // Initialisation des animations
        if (actions['Survey']) {
            Object.values(actions).forEach(action => {
                action.reset()
                action.setEffectiveTimeScale(1)
                action.setEffectiveWeight(0)
                action.fadeOut(0.5)
            })
            fadeToAction('Survey', 0.5)
        }
    }, [actions])

    useEffect(() => {
        if (currentAnimation && actions[currentAnimation]) {
            fadeToAction(currentAnimation, 0.2)
        }
    }, [currentAnimation, actions])

    useFrame((state, delta) => {
        if (!rigidBody.current || !orbitControlsRef.current) return

        const translation = rigidBody.current.translation()
        
        // Détection du sol
        const ray = new rapier.Ray(
            { x: translation.x, y: translation.y + 0.5, z: translation.z },
            { x: 0, y: -1, z: 0 }
        )
        const hit = world.castRay(ray, 1, true)
        const isGrounded = hit !== null

        // Mise à jour de la caméra
        const targetPosition = new THREE.Vector3(
            translation.x,
            translation.y ,
            translation.z
        )

        // Mise à jour de la cible et de la position de la caméra
        orbitControlsRef.current.target.lerp(targetPosition, 0.05)

        // Gestion du mouvement
        walkDirection.set(0, 0, 0)
        let velocity = 0

        const directionPressed = ['KeyW', 'KeyS', 'KeyA', 'KeyD'].some(key => keysPressed[key])
        
        if (directionPressed && isGrounded) {
            // Calculer la direction par rapport à la caméra
            const cameraForward = new THREE.Vector3()
            state.camera.getWorldDirection(cameraForward)
            cameraForward.y = 0
            cameraForward.normalize()

            // Calculer les directions relatives à la caméra
            const cameraRight = new THREE.Vector3()
            cameraRight.crossVectors(cameraForward, new THREE.Vector3(0, 1, 0))

            // Initialiser la direction
            walkDirection.set(0, 0, 0)

            // Combiner les directions selon les touches pressées
            const isMovingForward = keysPressed['KeyW']
            const isMovingBackward = keysPressed['KeyS']
            const isMovingLeft = keysPressed['KeyA']
            const isMovingRight = keysPressed['KeyD']

            if (isMovingForward) walkDirection.add(cameraForward)
            if (isMovingBackward) walkDirection.sub(cameraForward)
            if (isMovingLeft) walkDirection.sub(cameraRight)
            if (isMovingRight) walkDirection.add(cameraRight)

            // Normaliser la direction
            if (walkDirection.lengthSq() > 0) {
                walkDirection.normalize()

                // Rotation du modèle
                const rotationMatrix = new THREE.Matrix4()
                rotationMatrix.lookAt(walkDirection, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0))
                const targetQuaternion = new THREE.Quaternion()
                targetQuaternion.setFromRotationMatrix(rotationMatrix)
                fox.current.quaternion.rotateTowards(targetQuaternion, delta * 10)
                // rigidBody.current.setRotation({ x: 0, y: targetQuaternion.y, z: 0 }, true)
            }

            // Vitesse
            velocity = currentAnimation === 'Run' ? foxControls.runVelocity : foxControls.walkVelocity

            // Ajuster la vitesse de l'animation en fonction de la direction
            const currentAction = actions[currentAnimation]
            if (currentAction) {
                // Vitesse normale pour avant/arrière
                let timeScale = 1
                // Vitesse réduite pour les mouvements latéraux
                if ((isMovingLeft || isMovingRight) && !isMovingForward && !isMovingBackward) {
                    timeScale = 0.7
                }
                currentAction.setEffectiveTimeScale(timeScale)
            }

            // Animation
            if (currentAnimation === 'Survey') {
                setCurrentAnimation('Walk')
            }
        } else if (currentAnimation !== 'Survey') {
            setCurrentAnimation('Survey')
        }

        // Appliquer le mouvement
        if (isGrounded) {
            rigidBody.current.setLinvel(
                { 
                    x: walkDirection.x * velocity, 
                    y: Math.min(0, rigidBody.current.linvel().y),
                    z: walkDirection.z * velocity 
                }, 
                true
            )

            // Stabilisation supplémentaire
            rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
        }

        onPositionUpdate(translation)
    })

    return (
        <RigidBody  
            ref={rigidBody}
            type="dynamic" 
            position={position} 
            colliders={false}
            linearDamping={12}
            angularDamping={12}
            friction={2}
            mass={1}
            lockRotations={true}
            enabledRotations={[false, true, false]}
            gravityScale={1}
            ccd={true}
        >
            <primitive 
                ref={fox}
                object={scene} 
                scale={0.005}
                rotation={[0, Math.PI, 0]}
            />
            <BallCollider
               args={[0.3]} 
                position={[0, 0.3, 0]}
                // rotation={[ Math.PI / 2, 0, 0]}
                // friction={2}
                // restitution={0}
                // density={50}
            />
            {/* <RoundCylinderCollider
               args={[0.15, 0.17, 0.15]} 
                position={[0, 0.3, 0]}
                // rotation={[ Math.PI / 2, 0, 0]}
                friction={2}
                restitution={0}
                density={50}
            /> */}
            {/* <ConvexHullCollider
                args={[scene.children[0].children[0].geometry.attributes.position.array]}
                scale={0.005}
                rotation={[0, Math.PI, 0]}
                // position={[0, 0.2, 0]}
                friction={2}
                restitution={0}
                density={50}
            /> */}
        </RigidBody>
    )
}

function Terrain({ foxPosition }) {
    const grassTexture = useTexture('/grass.jpg')
    const cloudTexture = useTexture('/cloud.jpg')
    const [terrainData, setTerrainData] = useState(null)
    const meshRef = useRef()
    
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
            cloudUV.x += iTime / 300.0;
            cloudUV.y += iTime / 200.0;
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

    // Fonction de bruit personnalisée
    const noise = (nx, nz) => {
        // Plusieurs octaves de bruit pour plus de détails
        let e = 1.0;
        let n = 0.0;
        
        // Première octave - relief principal
        n += e * Math.sin(nx * 3.0) * Math.cos(nz * 3.0);
        e *= 0.5;
        
        // Deuxième octave - collines moyennes
        n += e * Math.sin(nx * 6.0) * Math.cos(nz * 6.0);
        e *= 0.5;

        // Troisième octave - petits détails
        n += e * Math.sin(nx * 12.0) * Math.cos(nz * 12.0);
        e *= 0.5;

        // Quatrième octave - micro-relief
        n += e * Math.sin(nx * 24.0) * Math.cos(nz * 24.0);

        // Normaliser entre 0 et 1
        return (n + 1.0) * 0.5;
    }

    useEffect(() => {
        const nsubdivs = 40 // Augmenter la résolution pour plus de détails
        const scale = { x: 100, y: 1.5, z: 100 } // Augmenter l'échelle Y pour plus de relief
        
        // Générer les hauteurs aléatoires
        const heights = new Float32Array((nsubdivs + 1) * (nsubdivs + 1))
        const vertices = new Float32Array((nsubdivs + 1) * (nsubdivs + 1) * 3)
        const uvs = new Float32Array((nsubdivs + 1) * (nsubdivs + 1) * 2)
        
        // Générer les hauteurs et les UVs
        for(let i = 0; i <= nsubdivs; i++) {
            for(let j = 0; j <= nsubdivs; j++) {
                const x = j / nsubdivs
                const z = i / nsubdivs
                
                // Générer la hauteur avec notre fonction de bruit
                const nx = x * Math.PI * 2
                const nz = z * Math.PI * 2
                const height = noise(nx, nz)
                
                // Index pour le heightfield (column-major order)
                const heightIndex = j * (nsubdivs + 1) + i
                heights[heightIndex] = height

                // Index pour les vertices (row-major order)
                const vertexIndex = (i * (nsubdivs + 1) + j) * 3
                vertices[vertexIndex] = (j / nsubdivs - 0.5) * scale.x     // x
                vertices[vertexIndex + 1] = height * scale.y               // y
                vertices[vertexIndex + 2] = (i / nsubdivs - 0.5) * scale.z // z

                // Index pour les UVs
                const uvIndex = (i * (nsubdivs + 1) + j) * 2
                uvs[uvIndex] = x     // u
                uvs[uvIndex + 1] = z // v
            }
        }

        // Créer la géométrie du terrain
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))

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
        geometry.setIndex(indices)
        geometry.computeVertexNormals()

        setTerrainData({
            heights,
            geometry,
            scale,
            nsubdivs,
            noise
        })
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
            <GrassField terrainData={terrainData} foxPosition={foxPosition} />
        </RigidBody>
    )
}

export default function Experience() {
    const orbitControlsRef = useRef()
    const [foxPosition, setFoxPosition] = useState([0, 0, 0])
    const sunPosition = new THREE.Vector3(1, 2, 3)

    const updateFoxPosition = (position) => {
        setFoxPosition([position.x, position.y, position.z])
    }

    return (
        <>
            <Physics
            // debug
             gravity={[0, -9.81, 0]}
             >
                <Terrain foxPosition={foxPosition} />
                <Fox 
                    position={[0, 2.5, 0]} 
                    orbitControlsRef={orbitControlsRef}
                    onPositionUpdate={updateFoxPosition}
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