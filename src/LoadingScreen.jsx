import { useProgress } from '@react-three/drei'
import { useEffect } from 'react'
import useGame from './utils/useGame'

export default function LoadingScreen() {
    const { progress, total, loaded, item } = useProgress()
    const { isInitialized, initialize } = useGame()

    const started = !isInitialized
    
    useEffect(() => {
        if (progress === 100) {
            setTimeout(() => {
                initialize()
            }, 500)
        }
    }, [progress, initialize])
    if(isInitialized) return null
    
    return (
        <div className={`loadingScreen ${started ? 'loadingScreen--started' : ''}`}>
            <div className="loadingScreen__progress">
                <div className="loadingScreen__progress__value" style={{
                    width: `${progress}%`
                }}></div>
            </div>
            <div className="loadingScreen__text">
                {/* {progress.toFixed(0)}% • {loaded}/{total} ressources chargées */}
            </div>
            <div className="loadingScreen__item">
                {/* {item} */}
            </div>
        </div>
    )
} 