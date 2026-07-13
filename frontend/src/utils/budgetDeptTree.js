// 예산부서(is_budget_dept) 트리 빌더 — AccountingPage/AccountInput/BudgetInput에서 공용으로 사용.
// 예산부서가 아닌 상위 조직도 "예산부서를 자손으로 가진 경로"라면 트리에 남겨서
// 계층 드롭다운으로 하위까지 내려갈 수 있게 한다.

export function buildBudgetPathTree(flat) {
  const budgetIds = new Set(flat.filter(d => d.is_budget_dept).map(d => d.id))

  function hasBudget(id) {
    if (budgetIds.has(id)) return true
    return flat.filter(d => d.parent_id === id).some(c => hasBudget(c.id))
  }

  function build(parentId) {
    return flat
      .filter(d => d.parent_id === (parentId ?? null) && hasBudget(d.id))
      .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
      .map(d => ({ ...d, children: build(d.id) }))
  }

  return build(null)
}

// 특정 dept id 의 조상 경로 (root → leaf)
export function getDeptPath(flat, deptId) {
  if (!deptId) return []
  const path = []
  let cur = flat.find(d => d.id === Number(deptId))
  while (cur) {
    path.unshift(cur.id)
    cur = cur.parent_id ? flat.find(d => d.id === cur.parent_id) : null
  }
  return path
}
