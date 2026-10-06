import {
    jackKnifeData,
    controlValues,
    heatmapValues,
    paretoData,
    summaryText,
    trendData,
    waterfallData,
    weekData,
  } from "@/data/analytics"
  import { initialFailures } from "@/data/failures"
  import { demoImport } from "@/data/imports"
  import { initialMachines, photos } from "@/data/machines"
  import { initialOrders } from "@/data/orders"
  import { mockViews } from "@/data/views"
  import type {
    MaintenanceRecords,
    PrototypeSnapshot,
  } from "@/types/maintenance"
  
  export function getDefaultMachinePhoto() {
    return photos[1]
  }
  
  export async function getPrototypeSnapshot(): Promise<PrototypeSnapshot> {
    return structuredClone(
      currentSnapshot || {
        machines: initialMachines,
        orders: initialOrders,
        failures: initialFailures,
        analytics: {
          weekData,
          trendData,
          paretoData,
          summaryText,
          jackKnifeData,
          controlValues,
          heatmapValues,
          waterfall: waterfallData,
        },
        views: mockViews,
        imports: demoImport,
      },
    )
  }
  
  let currentSnapshot: PrototypeSnapshot | null = null
  
  export async function saveMaintenanceRecords(
    records: MaintenanceRecords,
  ): Promise<void> {
    const current = await getPrototypeSnapshot()
  
    currentSnapshot = structuredClone({
      ...current,
      machines: records.machines,
      orders: records.orders,
      failures: records.failures,
      views: {
        ...current.views,
        initialHistory: records.history,
        initialUsers: records.users,
      },
    })
  }