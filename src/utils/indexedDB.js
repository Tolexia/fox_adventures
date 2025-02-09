const DB_NAME = 'hillFoxDB'
const DB_VERSION = 1
const STORE_NAME = 'terrainData'

export const initDB = () => {
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

export const saveTerrainData = async (data) => {
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
        console.error('Erreur lors de la sauvegarde des données du terrain:', error)
    }
}

export const getTerrainData = async () => {
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
        console.error('Erreur lors de la récupération des données du terrain:', error)
        return null
    }
} 