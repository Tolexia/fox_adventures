import { useProgress } from '@react-three/drei'
import { useEffect } from 'react'
import useLoadingStore from './stores/useLoadingStore'

export default function LoadingScreen() {
    const { progress } = useProgress()
    const grassLoaded = useLoadingStore((state) => state.grassLoaded)
    const started = useLoadingStore((state) => state.started)
    const setStarted = useLoadingStore((state) => state.setStarted)

    useEffect(() => {
        if (progress === 100 && grassLoaded && !started) {
            setStarted(true)
        }
    }, [progress, grassLoaded, started, setStarted])

    if (started) return null

    return (
        <div className="loadingScreen">
            <div className="loadingScreen__text">
                { `Loading ${progress.toFixed(0)}%`}
            </div>
            <div className="loadingScreen__progress">
                <div 
                    className="loadingScreen__progress__value" 
                    style={{
                        width: `${progress}%`
                    }}
                />
            </div>
            {progress === 100 && !grassLoaded && (
                <div className="loadingScreen__text">
                    Few details to set up...
                </div>
            )}
        </div>
    )
} 