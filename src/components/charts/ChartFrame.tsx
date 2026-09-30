import { type ReactNode, useEffect, useState } from "react"

export default function ChartFrame({
  children,
  height = 250,
}: {
  children: ReactNode
  height?: number
}) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 450)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div
      className={
        height === 320 ? "h-80" : height === 180 ? "h-[180px]" : "h-[250px]"
      }
    >
      {loading ? (
        <div
          className="flex h-full animate-pulse items-end gap-5 px-6 pb-6"
          aria-label="Carregando gráfico"
        >
          {[40, 75, 55, 90, 60, 45].map((size, index) => (
            <div
              key={index}
              className={`flex-1 rounded-t-md bg-gray-100 ${
                size > 70 ? "h-4/5" : size > 50 ? "h-3/5" : "h-2/5"
              }`}
            />
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  )
}
