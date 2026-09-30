export default function StackedCategoryLabel({
  x,
  y,
  width,
  height,
  category,
}: {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  category: string
}) {
  if (Number(height) < 18) return null
  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) + Number(height) / 2}
      fill="white"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={11}
      fontWeight={700}
    >
      {category}
    </text>
  )
}
