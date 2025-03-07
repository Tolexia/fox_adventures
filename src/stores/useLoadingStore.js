import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

const useLoadingStore = create(subscribeWithSelector((set) => ({
    grassLoaded: false,
    started: false,
    setGrassLoaded: (loaded) => set({ grassLoaded: loaded }),
    setStarted: (started) => set({ started }),
})))

export default useLoadingStore
