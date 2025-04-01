// import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'
import useGame from './utils/useGame'

export default function LoadingScreen() {
    // const { progress, total, loaded, item } = useProgress()
    const isInitialized = useGame((state) => state.isInitialized)
    const initialize = useGame((state) => state.initialize)
    // const chunksLoaded = useGame((state) => state.chunksLoaded)
    const totalChunks = useGame((state) => state.totalChunks)
    const [loaded, setLoaded] = useState(+ localStorage.getItem('chunksLoaded'))

    console.log("render LoadingScreen")

    // Gestion de la progression réelle
    useEffect(() => {
        const chunksLoaded = + localStorage.getItem('chunksLoaded')
        console.log("chunksLoaded", chunksLoaded)
        if (chunksLoaded >= totalChunks) {
            const timer = setTimeout(() => {
                localStorage.setItem('chunksLoaded', 0)
                initialize()
            }, 500)
            return () => clearTimeout(timer)
        }
        else if(loaded !== chunksLoaded){
            setLoaded(chunksLoaded)
        }
    }, [initialize])


    // console.log("loadingScreen", isInitialized)
    if(isInitialized) return null

    const progress = ((loaded / totalChunks) * 100).toFixed(0)
    console.log("progress", progress)
    
    return (
        <div className="loadingScreen">
            <div className="loadingScreen__progress">
                <div 
                    className="loadingScreen__progress__value" 
                    style={{
                        width: `${progress}%`
                    }}
                />
            </div>
            <div className="loadingScreen__text">
                {progress}% • {loaded}/{totalChunks} loaded
            </div>
        </div>
    )
} 