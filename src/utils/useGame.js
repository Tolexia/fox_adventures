import { create } from 'zustand'
// import { subscribeWithSelector } from 'zustand/middleware'

export default create((set, get) =>
{
    const params = new URLSearchParams(window.location.search)
    if(params.get('clear')) {
        localStorage.removeItem('foxPosition')
    }
    const savedPosition = localStorage.getItem('foxPosition') || "[0, 1, 0]"
    // const savedPosition = "[0, 0, 0]"
    const objectPosition = JSON.parse(savedPosition)
    objectPosition[1] += 1

    const planeSize = 100
    const chunkSize = 10
    const totalChunks = Math.ceil(planeSize / chunkSize) * Math.ceil(planeSize / chunkSize) 

    return {
        foxPosition: objectPosition,
        isInitialized: false,
        chunksLoaded: 0,
        PLANE_SIZE: planeSize,
        CHUNK_SIZE: chunkSize,
        totalChunks: totalChunks,

        incrementLoadedChunks: () => {
            localStorage.setItem('chunksLoaded', get().chunksLoaded + 1)
            return set((state) => ({ chunksLoaded: state.chunksLoaded + 1 }))
        },
      
        initialize: () => {
            set({ isInitialized: true })
        },

        updateFoxPosition: (newPosition) =>
        {
            localStorage.setItem('foxPosition', JSON.stringify(newPosition))
            return set({ foxPosition: newPosition })
        },


    }
})