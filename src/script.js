import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Base
 */
// Debug
const gui = new GUI()


/**
 * Models
 */
const gltfLoader = new GLTFLoader()
let mixer = null
let fox = null
gltfLoader.load(
    '/models/Fox/glTF/Fox.gltf',
    (gltf) =>
    {
        fox = gltf.scene
        fox.position.set(-3,0.72,-2)
        fox.scale.set(0.01, 0.01, 0.01)
        scene.add(fox)

        mixer = new THREE.AnimationMixer(fox)
        const stay = mixer.clipAction(gltf.animations[0])
        stay.play()

        const walk = mixer.clipAction(gltf.animations[1])
        const run = mixer.clipAction(gltf.animations[2])

        fox.stay = stay
        fox.walk = walk
        fox.run = run
    },
)
// gltfLoader.load(
//     '/models/grass_gltf/scene.gltf',
//     (gltf) =>
//     {
//         gltf.scene.scale.set(0.25, 0.25, 0.25)
//         for (let x = -5; x < 5; x+=1) {
//             for (let z = -5; z < 5; z+=1)
//             {
//                 const clone = gltf.scene.clone()
//                 clone.position.x = x
//                 clone.position.z = z
//                 scene.add(clone)
//             }
//         }
//         console.log("gltf.scene", gltf.scene)
//         // mixer = new THREE.AnimationMixer(gltf.scene)
//     },
// )


// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Floor
 */
const textureLoader = new THREE.TextureLoader()

const grassColorTexture = textureLoader.load('/textures/grass/color_v2.jpg')
grassColorTexture.colorSpace = THREE.SRGBColorSpace
grassColorTexture.repeat.set(32, 32)
grassColorTexture.wrapS = grassColorTexture.wrapT = THREE.RepeatWrapping

const disMap = textureLoader.load("/Heightmap.png")
disMap.wrapS = disMap.wrapT = THREE.RepeatWrapping
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100,1000,1000),
    new THREE.MeshStandardMaterial({
        color: '#416102',
        displacementMap: disMap,
        displacementScale:6,
        // wireframe: true,
        map: grassColorTexture,
        // metalness: 0,
        // roughness: 50
    })
)
floor.receiveShadow = true
floor.rotation.x = - Math.PI * 0.5
scene.add(floor)

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 2.4)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.camera.left = - 7
directionalLight.shadow.camera.top = 7
directionalLight.shadow.camera.right = 7
directionalLight.shadow.camera.bottom = - 7
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(3, 4, -3)

scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 0.75, 0)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * Animate
 */
const clock = new THREE.Clock()
let previousTime = 0

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    // Update controls
    controls.update()

    if(fox)
    {
        // if(elapsedTime != previousTime)
            // fox.position.x -= 0.01
        camera.lookAt(fox.position)
    }

    // Render
    renderer.render(scene, camera)

    if(mixer)
    {
        mixer.update(deltaTime)
    }

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()