import Badge from "@/components/ui/Badge"
import { type Order } from "@/types/maintenance"
import { ChevronRight } from "lucide-react"
import { Link } from "react-router"

export default function OrderTable({
  orders,
  compact = false,
  onSelect,
}: {
  orders: Order[]
  compact?: boolean
  onSelect?: (order: Order) => void
}) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Ordens de serviço em tabela rolável"
      className="overflow-x-auto rounded-md"
    >
      <table className="w-full whitespace-nowrap text-left text-xs">
        <caption className="sr-only">
          Ordens de serviço e acompanhamento das intervenções
        </caption>
        <thead className="border-y border-border bg-gray-50/70 text-[10px] font-semibold tracking-[0.04em] text-[#596270]">
          <tr>
            {[
              "OS Nº",
              "MÁQUINA",
              ...(compact
                ? ["TIPO", "CUSTO"]
                : ["TIPO", "PRIORIDADE", "TÉCNICO", "PRAZO"]),
              "STATUS",
              ...(compact ? ["AÇÃO"] : ["CRITICIDADE"]),
            ].map((heading, index) => (
              <th scope="col" key={index} className="px-5 py-3.5 font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.map((order) => (
            <tr
              key={order.id}
              className="group transition-colors hover:bg-gray-50/80"
            >
              <td className="px-5 py-4">
                {onSelect ? (
                  <button
                    onClick={() => onSelect(order)}
                    className="font-semibold text-accent-foreground"
                  >
                    #{order.id}
                  </button>
                ) : (
                  <Link
                    to="/ordens"
                    className="font-semibold text-accent-foreground"
                  >
                    #{order.id}
                  </Link>
                )}
              </td>
              <td className="px-5 py-4 font-medium">{order.machine}</td>
              <td className="px-5 py-4 text-[#596270]">{order.type}</td>
              {compact ? (
                <td className="px-5 py-4 text-gray-600">{order.cost}</td>
              ) : (
                <>
                  <td className="px-5 py-4">
                    <Badge status={order.priority} />
                  </td>
                  <td className="px-5 py-4 text-gray-600">{order.tech}</td>
                  <td className="px-5 py-4 text-gray-600">{order.date}</td>
                </>
              )}
              <td className="px-5 py-4">
                <Badge status={order.status} />
              </td>
              <td className="px-5 py-4">
                {compact ? (
                  <Link
                    to="/ordens"
                    aria-label={`Ver ordem ${order.id}`}
                    className="inline-flex p-2 text-[#596270] hover:text-accent-foreground"
                  >
                    <ChevronRight size={16} />
                  </Link>
                ) : (
                  <Badge status={order.critical} critical />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
