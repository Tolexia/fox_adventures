const DB_NAME = 'hillFoxDB'
const DB_VERSION = 1
const STORE_NAME = 'terrainData'

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)

        request.onupgradeneeded = (event) => {
            const db = event.target.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME)
            }
        }
    })
}

const saveTerrainData = async (data) => {
    try {
        const db = await initDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            
            const request = store.put(data, 'terrain')
            
            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result)
        })
    } catch (error) {
        self.postMessage({ type: 'error', error: 'Erreur lors de la sauvegarde des données du terrain' })
    }
}

const getTerrainData = async () => {
    try {
        const db = await initDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly')
            const store = transaction.objectStore(STORE_NAME)
            
            const request = store.get('terrain')
            
            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result)
        })
    } catch (error) {
        self.postMessage({ type: 'error', error: 'Erreur lors de la récupération des données du terrain' })
        return null
    }
}

// Fonction de bruit personnalisée
const noise = (nx, nz) => {
    let e = 1.0
    let n = 0.0
    
    n += e * Math.sin(nx * 3.0) * Math.cos(nz * 3.0)
    e *= 0.5
    
    n += e * Math.sin(nx * 6.0) * Math.cos(nz * 6.0)
    e *= 0.5

    n += e * Math.sin(nx * 12.0) * Math.cos(nz * 12.0)
    e *= 0.5

    n += e * Math.sin(nx * 24.0) * Math.cos(nz * 24.0)

    return (n + 1.0) * 0.5
}

const generateNewTerrain = () => {
    const nsubdivs = 40
    const scale = { x: 100, y: 1.5, z: 100 }
    
    const heights = new Float32Array((nsubdivs + 1) * (nsubdivs + 1))
    const vertices = new Float32Array((nsubdivs + 1) * (nsubdivs + 1) * 3)
    const uvs = new Float32Array((nsubdivs + 1) * (nsubdivs + 1) * 2)
    
    for(let i = 0; i <= nsubdivs; i++) {
        for(let j = 0; j <= nsubdivs; j++) {
            const x = j / nsubdivs
            const z = i / nsubdivs
            
            const nx = x * Math.PI * 2
            const nz = z * Math.PI * 2
            const height = noise(nx, nz)
            
            const heightIndex = j * (nsubdivs + 1) + i
            heights[heightIndex] = height

            const vertexIndex = (i * (nsubdivs + 1) + j) * 3
            vertices[vertexIndex] = (j / nsubdivs - 0.5) * scale.x
            vertices[vertexIndex + 1] = height * scale.y
            vertices[vertexIndex + 2] = (i / nsubdivs - 0.5) * scale.z

            const uvIndex = (i * (nsubdivs + 1) + j) * 2
            uvs[uvIndex] = x
            uvs[uvIndex + 1] = z
        }
    }

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

    return {
        heights: Array.from(heights),
        vertices: Array.from(vertices),
        uvs: Array.from(uvs),
        indices,
        scale,
        nsubdivs
    }
}

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

    // const distanceFromCenter = Math.sqrt(center.x * center.x + center.z * center.z)
    const rotationBias = Math.atan2(center.z, center.x)
    const yaw = rotationBias + (Math.random() - 0.5) * Math.PI * 0.5
    const yawUnitVec = { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) }
    const tipBend = yaw + (Math.random() - 0.5) * Math.PI * 0.25
    const tipBendUnitVec = { x: Math.sin(tipBend), y: 0, z: -Math.cos(tipBend) }

    // Helper function to add vectors
    const addVectors = (a, b, scale = 1) => ({
        x: a.x + b.x * scale,
        y: a.y + b.y * scale,
        z: a.z + b.z * scale
    })

    const bl = addVectors(center, yawUnitVec, (BLADE_WIDTH / 2))
    const br = addVectors(center, yawUnitVec, -(BLADE_WIDTH / 2))
    const tl = addVectors(center, yawUnitVec, (MID_WIDTH / 2))
    const tr = addVectors(center, yawUnitVec, -(MID_WIDTH / 2))
    const tc = addVectors(center, tipBendUnitVec, TIP_OFFSET)

    tl.y += height / 2
    tr.y += height / 2
    tc.y += height

    const black = [0, 0, 0]
    const gray = [0.5, 0.5, 0.5]
    const white = [1.0, 1.0, 1.0]

    const verts = [
        { pos: [bl.x, bl.y, bl.z], uv, color: black },
        { pos: [br.x, br.y, br.z], uv, color: black },
        { pos: [tr.x, tr.y, tr.z], uv, color: gray },
        { pos: [tl.x, tl.y, tl.z], uv, color: gray },
        { pos: [tc.x, tc.y, tc.z], uv, color: white }
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

function getTerrainHeight(x, z, terrainData) {
    if (!terrainData) return 0

    const gridX = Math.max(0, Math.min(terrainData.nsubdivs, ((x / terrainData.scale.x) + 0.5) * terrainData.nsubdivs))
    const gridZ = Math.max(0, Math.min(terrainData.nsubdivs, ((z / terrainData.scale.z) + 0.5) * terrainData.nsubdivs))

    const x0 = Math.floor(gridX)
    const z0 = Math.floor(gridZ)
    const x1 = Math.min(x0 + 1, terrainData.nsubdivs)
    const z1 = Math.min(z0 + 1, terrainData.nsubdivs)

    const wx = gridX - x0
    const wz = gridZ - z0

    const h00 = terrainData.heights[x0 * (terrainData.nsubdivs + 1) + z0] * terrainData.scale.y
    const h10 = terrainData.heights[x1 * (terrainData.nsubdivs + 1) + z0] * terrainData.scale.y
    const h01 = terrainData.heights[x0 * (terrainData.nsubdivs + 1) + z1] * terrainData.scale.y
    const h11 = terrainData.heights[x1 * (terrainData.nsubdivs + 1) + z1] * terrainData.scale.y

    const h0 = h00 * (1 - wx) + h10 * wx
    const h1 = h01 * (1 - wx) + h11 * wx
    return h0 * (1 - wz) + h1 * wz
}

function generateGrassGeometry(terrainData) {
    const positions = []
    const uvs = []
    const indices = []
    const colors = []

    const gridSize = Math.sqrt(BLADE_COUNT)
    const cellSize = PLANE_SIZE / gridSize

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const baseX = (i / gridSize - 0.5) * PLANE_SIZE
            const baseZ = (j / gridSize - 0.5) * PLANE_SIZE

            const offsetX = (Math.random() - 0.5) * cellSize * 0.8
            const offsetZ = (Math.random() - 0.5) * cellSize * 0.8

            const x = baseX + offsetX
            const z = baseZ + offsetZ

            if (Math.abs(x) <= PLANE_SIZE / 2 && Math.abs(z) <= PLANE_SIZE / 2) {
                const y = getTerrainHeight(x, z, terrainData)
                const pos = { x, y, z }

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

                // Envoyer la progression tous les 1000 brins d'herbe
                if (positions.length % 15000 === 0) {
                    self.postMessage({
                        type: 'progress',
                        data: (positions.length / 15) / BLADE_COUNT * 100
                    })
                }
            }
        }
    }

    return {
        positions,
        uvs,
        indices,
        colors
    }
}

self.onmessage = async (event) => {
    const { type, data } = event.data

    switch (type) {
        case 'init':
            const searchParams = new URLSearchParams(data.url)
            const clearData = searchParams.get('clear')

            if (clearData) {
                const newTerrain = generateNewTerrain()
                await saveTerrainData(newTerrain)
                self.postMessage({ type: 'terrainData', data: newTerrain })
                return
            }

            const savedData = await getTerrainData()
            if (savedData) {
                self.postMessage({ type: 'terrainData', data: savedData })
            } else {
                const newTerrain = generateNewTerrain()
                await saveTerrainData(newTerrain)
                self.postMessage({ type: 'terrainData', data: newTerrain })
            }
            break

        case 'generateGrass':
            const geometry = generateGrassGeometry(data.terrainData)
            self.postMessage({
                type: 'grassGeometry',
                data: geometry
            })
            break

        case 'getHeight':
            const height = getTerrainHeight(data.x, data.z, data.terrainData)
            self.postMessage({
                type: 'height',
                data: height
            })
            break
    }
} 