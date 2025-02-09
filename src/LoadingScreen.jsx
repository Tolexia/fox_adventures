import { useProgress } from '@react-three/drei'
import { useEffect } from 'react'

export default function LoadingScreen({ started, onStarted }) {
    const { progress, total, loaded, item } = useProgress()

    useEffect(() => {
        if (progress === 100) {
            setTimeout(() => {
                onStarted()
            }, 500)
        }
    }, [progress, onStarted])

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