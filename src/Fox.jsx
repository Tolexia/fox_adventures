import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, useRapier, BallCollider } from '@react-three/rapier'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import useGame from './utils/useGame'

export default function Fox({ orbitControlsRef }) {
    const fox = useRef()
    const rigidBody = useRef()
    const { scene, animations } = useGLTF('./models/Fox/glTF/Fox.gltf')
    const { actions } = useAnimations(animations, fox)
    const currentAnimation = useRef('Survey')
    const { rapier, world } = useRapier()

    let foxPosition = useGame((state) => state.foxPosition)
    const updateFoxPosition = useGame((state) => state.updateFoxPosition)

    console.log("render Fox")

    const onPositionUpdate = (position) => {
        if(position.y < -10) {
            position.x = 0
            position.y = 0
            position.z = 0
        }
        const newPosition = [position.x, position.y, position.z]
        if (JSON.stringify(newPosition) !== JSON.stringify(foxPosition)) {
            updateFoxPosition(newPosition)
        }
    }

    // Vecteurs temporaires pour les calculs
    const walkDirection = new THREE.Vector3()
    const keysPressed = useRef({})

    const foxControls = {
        walkVelocity:  2,
        runVelocity:  4,
    }

    useEffect(() => {
        const handleKeyDown = (e) => {
            keysPressed.current = { ...keysPressed.current, [e.code]: true }
            if (e.code === 'ShiftLeft') {
                currentAnimation.current = currentAnimation.current === 'Run' ? 'Walk' : 'Run'
                updateAnimation()
            }
        }

        const handleKeyUp = (e) => {
            keysPressed.current = { ...keysPressed.current, [e.code]: false }
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
        const searchParams = new URLSearchParams(window.location.search)
        const clearPosition = searchParams.get('clear')
        if (clearPosition) {
            localStorage.clear()
            foxPosition = [0, 1, 0]
        }

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

    const updateAnimation = () => {
        fadeToAction(currentAnimation.current, 0.2)
    }
    useEffect(() => {
        updateAnimation()
    }, [currentAnimation.current, actions])

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

        const directionPressed = ['KeyW', 'KeyS', 'KeyA', 'KeyD'].some(key => keysPressed.current[key])
        
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
            const isMovingForward = keysPressed.current['KeyW']
            const isMovingBackward = keysPressed.current['KeyS']
            const isMovingLeft = keysPressed.current['KeyA']
            const isMovingRight = keysPressed.current['KeyD']

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
            velocity = currentAnimation.current === 'Run' ? foxControls.runVelocity : foxControls.walkVelocity

            // Ajuster la vitesse de l'animation en fonction de la direction
            const currentAction = actions[currentAnimation.current]
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
            if (currentAnimation.current === 'Survey') {
                currentAnimation.current = 'Walk'
                updateAnimation()
            }
        } else if (currentAnimation.current !== 'Survey') {
            currentAnimation.current = 'Survey'
            updateAnimation()
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
            position={foxPosition} 
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