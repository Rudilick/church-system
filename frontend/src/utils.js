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
