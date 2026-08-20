import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
})

// 요청마다 JWT 토큰 주입
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 → 로그인 페이지로 이동
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const preferences = {
  get:   ()     => api.get('/preferences'),
  patch: (data) => api.patch('/preferences', data),
}

export const auth = {
  googleLogin:    (credential) => api.post('/auth/google', { credential }),
  me:             ()           => api.get('/auth/me'),
  logout:         ()           => api.post('/auth/logout'),
  icalToken:      ()           => api.get('/auth/ical-token'),
  regenerateIcal: ()           => api.post('/auth/ical-token/regenerate'),
}

export const admin = {
  users:         (q)    => api.get('/admin/users', { params: q ? { q } : {} }),
  userStats:     ()     => api.get('/admin/users/stats'),
  createUser:    (data) => api.post('/admin/users', data),
  updateUser:    (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser:    (id)   => api.delete(`/admin/users/${id}`),
  backups:       ()     => api.get('/admin/backups'),
  backupDownload:(id)   => api.get(`/admin/backups/${id}/download`, { responseType: 'blob' }),
  backupRun:     ()     => api.post('/admin/backups/run'),
}

export const members = {
  list:         (params)               => api.get('/members', { params }),
  search:       (conditions, sort)     => api.get('/members', {
    params: { conditions: JSON.stringify(conditions), sort, limit: 1000 }
  }),
  get:          (id)                   => api.get(`/members/${id}`),
  create:       (data)                 => api.post('/members', data),
  update:       (id, data)             => api.put(`/members/${id}`, data),
  remove:       (id)                   => api.delete(`/members/${id}`),
  birthdays:    (days)                 => api.get('/members/birthdays/upcoming', { params: { days } }),
  weekEvents:   (days)                 => api.get('/members/week-events', { params: { days } }),
  activityFeed: (limit)                => api.get('/members/activity-feed', { params: { limit } }),
  notes:        (id)                   => api.get(`/members/${id}/notes`),
  addNote:      (id, content, eventData) => api.post(`/members/${id}/notes`, { content, ...eventData }),
  updateNote:   (id, noteId, content, eventData) => api.put(`/members/${id}/notes/${noteId}`, { content, ...eventData }),
  removeNote:   (id, noteId)           => api.delete(`/members/${id}/notes/${noteId}`),
  suggest:      (field, q)             => api.get('/members/suggest', { params: { field, q } }).then(r => r.data),
  bulkTemplate: ()                     => api.get('/members/bulk-template', { responseType: 'blob' }),
  bulkUpload:   (file, mode = 'fill_blanks') => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', mode)
    return api.post('/members/bulk-upload', fd)
  },
  fullExport:   (ids)                  => {
    const params = ids?.length ? { ids: ids.join(',') } : {}
    return api.get('/members/full-export', { responseType: 'blob', params })
  },
  bulkRemove:   (ids)                  => api.delete('/members/bulk', { data: { ids } }),
}

export const families = {
  add:    (data) => api.post('/families', data),
  remove: (data) => api.delete('/families', { data }),
}

export const communities = {
  list:          (params) => api.get('/communities', { params }),
  tree:          ()       => api.get('/communities', { params: { tree: true } }),
  get:           (id)     => api.get(`/communities/${id}`),
  create:        (data)   => api.post('/communities', data),
  update:        (id, data) => api.put(`/communities/${id}`, data),
  remove:        (id)     => api.delete(`/communities/${id}`),
  addMember:     (id, data) => api.post(`/communities/${id}/members`, data),
  removeMember:  (id, memberId) => api.delete(`/communities/${id}/members/${memberId}`),
  getSettings:   ()       => api.get('/communities/settings'),
  saveSettings:  (levels) => api.put('/communities/settings', { levels }),
}

export const departments = {
  list:         ()              => api.get('/departments'),
  tree:         ()              => api.get('/departments', { params: { tree: true } }),
  get:          (id)            => api.get(`/departments/${id}`),
  create:       (data)          => api.post('/departments', data),
  update:       (id, data)      => api.put(`/departments/${id}`, data),
  remove:       (id)            => api.delete(`/departments/${id}`),
  addMember:    (id, data)      => api.post(`/departments/${id}/members`, data),
  updateMember: (id, mid, data) => api.put(`/departments/${id}/members/${mid}`, data),
  removeMember: (id, memberId)  => api.delete(`/departments/${id}/members/${memberId}`),
  byMember:     (memberId)      => api.get(`/departments/by-member/${memberId}`),
  clearMember:  (memberId)      => api.delete(`/departments/by-member/${memberId}`),
  seedOrg:      ()              => api.post('/departments/seed-org'),
  syncToComm:   (id)           => api.post(`/departments/${id}/sync-to-communities`),
  unsyncFromComm: (id)         => api.post(`/departments/${id}/unsync-communities`),
}

export const attendance = {
  services:          ()         => api.get('/attendance/services'),
  addService:        (data)     => api.post('/attendance/services', data),
  updateService:     (id, data) => api.put(`/attendance/services/${id}`, data),
  removeService:     (id)       => api.delete(`/attendance/services/${id}`),
  serviceCategories: ()         => api.get('/attendance/service-categories'),
  addCategory:       (data)     => api.post('/attendance/service-categories', data),
  updateCategory:    (id, data) => api.put(`/attendance/service-categories/${id}`, data),
  removeCategory:    (id)       => api.delete(`/attendance/service-categories/${id}`),
  list:              (params)   => api.get('/attendance', { params }),
  add:               (data)     => api.post('/attendance', data),
  qr:                (data)     => api.post('/attendance/qr', data),
  remove:            (id)       => api.delete(`/attendance/${id}`),
  stats:             (params)   => api.get('/attendance/stats', { params }),
  statsWeekly:       (params)   => api.get('/attendance/stats/weekly', { params }),
  statsCompareYear:  (params)   => api.get('/attendance/stats/compare-year', { params }),
  statsAge:          (params)   => api.get('/attendance/stats/age-distribution', { params }),
  statsFamily:       (params)   => api.get('/attendance/stats/family', { params }),
  copyLastWeek:      (data)     => api.post('/attendance/copy-last-week', data),
  absentMembers:     (serviceId) => api.get('/attendance/absent-members', { params: serviceId ? { service_id: serviceId } : {} }),
  absentSummary:     ()          => api.get('/attendance/absent-summary'),
  offWeeks:          ()          => api.get('/attendance/service-weeks/off'),
  toggleOffWeek:     (date)      => api.post('/attendance/service-weeks/toggle', { date }),
  memberHistory:     (memberId, limit) => api.get(`/attendance/member/${memberId}`, { params: limit ? { limit } : {} }),
}

export const offering = {
  types:       ()           => api.get('/offering/types'),
  dailyCounts: (date)       => api.get('/offering/daily-counts', { params: { date } }),
  list:        (params)     => api.get('/offering', { params }),
  add:         (data)       => api.post('/offering', data),
  update:      (id, data)   => api.put(`/offering/${id}`, data),
  remove:      (id)         => api.delete(`/offering/${id}`),
  summary:     (params)     => api.get('/offering/summary', { params }),
  stats:       (params)     => api.get('/offering/stats',   { params }),
}

export const budget = {
  fiscalYears:      ()       => api.get('/budget/fiscal-years'),
  categories:       (params) => api.get('/budget/categories', { params }),
  categoriesSummary:(params) => api.get('/budget/categories/summary', { params }),
  createCategory:   (data)   => api.post('/budget/categories', data),
  updateCategory:   (id, data) => api.patch(`/budget/categories/${id}`, data),
  deleteCategory:   (id)     => api.delete(`/budget/categories/${id}`),
  transactions:     (params) => api.get('/budget/transactions', { params }),
  addTransaction:   (data)   => api.post('/budget/transactions', data),
  removeTransaction:(id)     => api.delete(`/budget/transactions/${id}`),
  report:           (params) => api.get('/budget/report', { params }),
}

export const pastoral = {
  list:      (params)     => api.get('/pastoral', { params }),
  add:       (data)       => api.post('/pastoral', data),
  update:    (id, data)   => api.put(`/pastoral/${id}`, data),
  remove:    (id)         => api.delete(`/pastoral/${id}`),
  unvisited: (params)     => api.get('/pastoral/unvisited', { params }),
}

export const prayer = {
  list:   (params)     => api.get('/prayer', { params }),
  add:    (data)       => api.post('/prayer', data),
  update: (id, data)   => api.put(`/prayer/${id}`, data),
  remove: (id)         => api.delete(`/prayer/${id}`),
}

export const calendar = {
  list:        (year, month) => api.get('/calendar', { params: { year, month } }),
  add:         (data)        => api.post('/calendar', data),
  update:      (id, data)    => api.put(`/calendar/${id}`, data),
  remove:      (id)          => api.delete(`/calendar/${id}`),
  removeGroup: (groupId)     => api.delete(`/calendar/recurrence/${groupId}`),
}

export const todos = {
  list:   ()           => api.get('/todos'),
  add:    (data)       => api.post('/todos', data),
  update: (id, data)   => api.put(`/todos/${id}`, data),
  remove: (id)         => api.delete(`/todos/${id}`),
}

export const messenger = {
  rooms:       (userId) => api.get('/messenger/rooms', { params: { user_id: userId } }),
  createRoom:  (data)   => api.post('/messenger/rooms', data),
  messages:    (roomId, params) => api.get(`/messenger/rooms/${roomId}/messages`, { params }),
  send:        (roomId, data)   => api.post(`/messenger/rooms/${roomId}/messages`, data),
  markRead:    (msgId, userId)  => api.post(`/messenger/messages/${msgId}/read`, { user_id: userId }),
}

export const sms = {
  logs:    ()       => api.get('/sms'),
  send:    (data)   => api.post('/sms/send', data),
  preview: (params) => api.get('/sms/preview', { params }),
  optOut: {
    list:   ()       => api.get('/sms/opt-out'),
    add:    (memberId, reason) => api.post('/sms/opt-out', { member_id: memberId, reason }),
    remove: (memberId)         => api.delete(`/sms/opt-out/${memberId}`),
  },
}

export const kakaoTemplates = {
  list:   ()     => api.get('/kakao-templates'),
  create: (data) => api.post('/kakao-templates', data),
  update: (id, data) => api.patch(`/kakao-templates/${id}`, data),
}

export const settings = {
  get:               ()                      => api.get('/settings'),
  update:            (data)                  => api.put('/settings', data),
  verifyMemberPin:   (pin)                   => api.post('/settings/verify-member-pin', { pin }),
  verifyDeletePin:   (pin)                   => api.post('/settings/verify-delete-pin', { pin }),
  verifyFinancePin:  (pin)                   => api.post('/settings/verify-finance-pin', { pin }),
  updateFinancePin:  (current_pin, new_pin)  => api.post('/settings/update-finance-pin', { current_pin, new_pin }),
}

export const expenses = {
  list:   (params)     => api.get('/expenses', { params }),
  add:    (data)       => api.post('/expenses', data),
  update: (id, data)   => api.put(`/expenses/${id}`, data),
  remove: (id)         => api.delete(`/expenses/${id}`),
}

export const positions = {
  list:   (params)     => api.get('/positions', { params }),
  create: (data)       => api.post('/positions', data),
  update: (id, data)   => api.put(`/positions/${id}`, data),
  remove: (id)         => api.delete(`/positions/${id}`),
}

export const enumValues = {
  list:   (type)       => api.get('/enum-values', { params: type ? { type } : {} }),
  create: (data)       => api.post('/enum-values', data),
  update: (id, data)   => api.put(`/enum-values/${id}`, data),
  remove: (id)         => api.delete(`/enum-values/${id}`),
}

export const worshipQueues = {
  list:          ()            => api.get('/worship-queues'),
  create:        (data)        => api.post('/worship-queues', data),
  update:        (id, data)    => api.put(`/worship-queues/${id}`, data),
  remove:        (id)          => api.delete(`/worship-queues/${id}`),
  getSongs:      (id)          => api.get(`/worship-queues/${id}/songs`),
  saveSongs:     (id, songs)   => api.put(`/worship-queues/${id}/songs`, { items: songs }),
  saveItems:     (id, items)   => api.put(`/worship-queues/${id}/songs`, { items }),
  searchSongLib: (q)           => api.get('/worship-queues/song-library/search', { params: { q } }),
  songHistory:   (title)       => api.get('/worship-queues/songs/history', { params: { title } }),
  deleteSong:    (id)          => api.delete(`/worship-queues/songs/${id}`),
}

export const clergy = {
  list:   ()           => api.get('/clergy'),
  create: (data)       => api.post('/clergy', data),
  update: (id, data)   => api.put(`/clergy/${id}`, data),
  remove: (id)         => api.delete(`/clergy/${id}`),
}

export const vehicles = {
  list:            ()           => api.get('/vehicles'),
  create:          (data)       => api.post('/vehicles', data),
  update:          (id, data)   => api.patch(`/vehicles/${id}`, data),
  dispatches:      (params)     => api.get('/vehicles/dispatches', { params }),
  updateDispatch:  (id, data)   => api.patch(`/vehicles/dispatches/${id}`, data),
  deleteDispatch:  (id)         => api.delete(`/vehicles/dispatches/${id}`),
  recurringSchedules:       (vehicleId)       => api.get(`/vehicles/${vehicleId}/recurring-schedules`),
  createRecurringSchedule:  (vehicleId, data) => api.post(`/vehicles/${vehicleId}/recurring-schedules`, data),
  updateRecurringSchedule:  (id, data)        => api.patch(`/vehicles/recurring-schedules/${id}`, data),
  deleteRecurringSchedule:  (id)              => api.delete(`/vehicles/recurring-schedules/${id}`),
}

const PUBLIC_BASE = import.meta.env.VITE_API_URL ?? '/api'

async function publicFetch(path, options = {}) {
  const res = await fetch(`${PUBLIC_BASE}/public${path}`, options)
  const data = await res.json()
  if (!res.ok) throw { status: res.status, message: data.error || '오류가 발생했습니다.' }
  return data
}

export const feedback = {
  list: ()     => api.get('/feedback'),
  add:  (data) => api.post('/feedback', data),
}

export const publicApi = {
  departments: () => publicFetch('/departments'),
  addExpense:  (data) => publicFetch('/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  vehicleList:     ()           => publicFetch('/vehicles'),
  vehicleDispatches: (vehicle_id, date) => publicFetch(`/vehicle-dispatch?vehicle_id=${vehicle_id}&date=${date}`),
  vehicleRequest:  (data)       => publicFetch('/vehicle-dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
}

export default api
