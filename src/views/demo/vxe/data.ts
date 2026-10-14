export interface DemoItem {
  id: number
  code: string
  name: string
  specification: string
  unit: string
  category: string
  status: '0' | '1'
}

export interface DemoCategory {
  id: number
  parentId: number
  code: string
  name: string
  status: '0' | '1'
}

export interface DemoLine {
  id: number
  code: string
  name: string
  quantity: number
  price: number
  deliveryDate: string
  remark: string
}

const materials = [
  ['304不锈钢螺栓', 'M8 × 30', '件', '五金标准件'],
  ['深沟球轴承', '6204-2RS', '套', '机械配件'],
  ['工业包装纸箱', '400 × 300 × 250', '个', '包装材料'],
  ['弹簧垫圈', 'M8 / 304', '件', '五金标准件']
]

export function createItems(count = 100): DemoItem[] {
  return Array.from({ length: count }, (_, index) => {
    const [name, specification, unit, category] = materials[index % materials.length]
    return {
      id: index + 1,
      code: `MAT-${String(index + 1).padStart(4, '0')}`,
      name,
      specification,
      unit,
      category,
      status: index % 7 === 6 ? '1' : '0'
    }
  })
}

export function createLines(count = 10): DemoLine[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    code: `MAT-${String(index + 1).padStart(4, '0')}`,
    name: materials[index % materials.length][0],
    quantity: index === 0 ? 2000 : index === 1 ? 120 : 300,
    price: index === 0 ? 0.45 : index === 1 ? 18.5 : 3.2,
    deliveryDate: '2026-10-24',
    remark: ''
  }))
}

export const categories: DemoCategory[] = [
  { id: 1, parentId: 0, code: 'RAW', name: '原材料', status: '0' },
  { id: 2, parentId: 1, code: 'METAL', name: '金属材料', status: '0' },
  { id: 3, parentId: 2, code: 'STEEL', name: '钢材', status: '0' },
  { id: 4, parentId: 1, code: 'HARDWARE', name: '五金标准件', status: '0' },
  { id: 5, parentId: 0, code: 'PACK', name: '包装材料', status: '0' },
  { id: 6, parentId: 5, code: 'CARTON', name: '纸箱', status: '0' },
  { id: 7, parentId: 5, code: 'LEGACY', name: '旧包装材料', status: '1' }
]

export function lineAmount(row: DemoLine): number {
  return Math.round((Number(row.quantity) || 0) * (Number(row.price) || 0) * 100) / 100
}
