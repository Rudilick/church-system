import dayjs from 'dayjs'

export function genderColor(gender) {
  return gender === 'M' ? '#3b82f6' : gender === 'F' ? '#f472b6' : '#94a3b8'
}

export function calcWesternAge(birthDate) {
  if (!birthDate) return null
  const birth = dayjs(birthDate)
  const today = dayjs()
  let age = today.year() - birth.year()
  if (today.month() < birth.month() ||
      (today.month() === birth.month() && today.date() < birth.date())) age--
  return age
}

export function isRetired(birthDate) {
  const age = calcWesternAge(birthDate)
  return age != null && age >= 70
}

export function displayPosition(member) {
  if (!member?.position) return member?.position
  return isRetired(member.birth_date) ? `은퇴${member.position}` : member.position
}

// 문자열 앞선 순서(코드포인트)로만 비교 — localeCompare의 로케일별 정렬 규칙에 기대지 않고
// 순수 ㄱㄴㄷ 앞선순 비교(글자 수에 영향받지 않음)를 보장한다.
export function compareName(a, b) {
  const x = a ?? '', y = b ?? ''
  return x < y ? -1 : x > y ? 1 : 0
}
