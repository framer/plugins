import { motion, useAnimation } from "framer-motion"
import { useEffect } from "react"

export function FadeInMasked({ children, shouldAnimate }: { children: React.ReactNode; shouldAnimate: boolean }) {
    const controls = useAnimation()

    useEffect(() => {
        if (!shouldAnimate) return

        controls.start({
            maskPosition: "0 0%",
            transition: { duration: 1.2, ease: "easeInOut" },
        })
    }, [controls, shouldAnimate])

    if (!shouldAnimate) return children

    return (
        <motion.div
            initial={{
                maskPosition: "0 100%",
            }}
            animate={controls}
            style={{
                maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                WebkitMaskSize: "100% 200%",
                maskSize: "100% 200%",
            }}
        >
            {children}
        </motion.div>
    )
}
