import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
export default create(subscribeWithSelector((set, get) =>
{
    const params = new URLSearchParams(window.location.search)
    if(params.get('clear')) {
        localStorage.removeItem('foxPosition')
    }
    const savedPosition = localStorage.getItem('foxPosition') || "[0, 1, 0]"
    // const savedPosition = "[0, 0, 0]"
    const objectPosition = JSON.parse(savedPosition)
    objectPosition[1] += 1

    return {
        foxPosition: objectPosition,
        isInitialized: false,

        initialize: () =>
        {
            set({ isInitialized: true })
        },

        updateFoxPosition: (newPosition) =>
        {
            localStorage.setItem('foxPosition', JSON.stringify(newPosition))
            return set({ foxPosition: newPosition })
        },


    }
}))