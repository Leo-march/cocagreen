import { useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"

export default function AnimatedNumber({
  value,
  decimals = 0,
}: {
  value: number
  decimals?: number
}) {
  const [current, setCurrent] = useState(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) {
      setCurrent(value)
      return
    }
    let frame: number
    const start = performance.now()
    const step = (time: number) => {
      const progress = Math.min((time - start) / 950, 1)
      setCurrent(value * (1 - Math.pow(1 - progress, 3)))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, reduced])
  return (
    <>
      {current.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </>
  )
}
