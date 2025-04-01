const DB_NAME = 'hillFoxDB'
const DB_VERSION = 1
// const STORE_NAME = 'terrainData'

export const initDB = (storeName) => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)

        request.onupgradeneeded = (event) => {
            const db = event.target.result
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName)
            }
        }
    })
}

const getChunkData = async (x,z, storeName) => {
    try {
        const db = await initDB(storeName)
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly')
            const store = transaction.objectStore(storeName)
            
            const request = store.get(`${x}-${z}`)
            
            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result)
        })
    } catch (error) {
        console.error('Erreur lors de la récupération des données du terrain:', error)
        return null
    }
}

const saveChunkData = async (x,z,data) => {
    const storeName = 'chunkData'
    try {
        const db = await initDB(storeName)
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite')
            const store = transaction.objectStore(storeName)
            
            const request = store.put(data, `${x}-${z}`)
            
            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result)
        })
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des données du terrain:', error)
    }
}

export const saveTerrainData = async (x,z,data) => {
    const storeName = 'terrainData'
    return saveChunkData(x,z,data, storeName)
}

export const getTerrainData = async (x,z) => {
    const storeName = 'terrainData'
    return getChunkData(x,z, storeName)
} 


export const saveGrassData = async (x,z,data) => {
    const storeName = 'grassData'
    return saveChunkData(x,z,data, storeName)
}

export const getGrassData = async (x,z) => {
    const storeName = 'grassData'
    return getChunkData(x,z, storeName)
} 
