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

export const auth = {
  googleLogin: (credential) => api.post('/auth/google', { credential }),
  me:          ()           => api.get('/auth/me'),
  logout:      ()           => api.post('/auth/logout'),
}

export const admin = {
  users:      (q)        => api.get('/admin/users', { params: q ? { q } : {} }),
  userStats:  ()         => api.get('/admin/users/stats'),
  createUser: (data)     => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id)       => api.delete(`/admin/users/${id}`),
}

export const members = {
  list:       (params)         => api.get('/members', { params }),
  get:        (id)             => api.get(`/members/${id}`),
  create:     (data)           => api.post('/members', data),
  update:     (id, data)       => api.put(`/members/${id}`, data),
  remove:     (id)             => api.delete(`/members/${id}`),
  birthdays:  (days)           => api.get('/members/birthdays/upcoming', { params: { days } }),
  notes:      (id)             => api.get(`/members/${id}/notes`),
  addNote:    (id, content, eventData) => api.post(`/members/${id}/notes`, { content, ...eventData }),
  removeNote: (id, noteId)     => api.delete(`/members/${id}/notes/${noteId}`),
}

export const families = {
  add:    (data) => api.post('/families', data),
  remove: (data) => api.delete('/families', { data }),
}

export const communities = {
  list:          (params) => api.get('/communities', { params }),
  get:           (id)     => api.get(`/communities/${id}`),
  create:        (data)   => api.post('/communities', data),
  update:        (id, data) => api.put(`/communities/${id}`, data),
  remove:        (id)     => api.delete(`/communities/${id}`),
  addMember:     (id, data) => api.post(`/communities/${id}/members`, data),
  removeMember:  (id, memberId) => api.delete(`/communities/${id}/members/${memberId}`),
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
}

export const attendance = {
  services: ()       => api.get('/attendance/services'),
  list:     (params) => api.get('/attendance', { params }),
  add:      (data)   => api.post('/attendance', data),
  qr:       (data)   => api.post('/attendance/qr', data),
  remove:   (id)     => api.delete(`/attendance/${id}`),
  stats:    (params) => api.get('/attendance/stats', { params }),
}

export const offering = {
  types:       ()           => api.get('/offering/types'),
  dailyCounts: (date)       => api.get('/offering/daily-counts', { params: { date } }),
  list:        (params)     => api.get('/offering', { params }),
  add:         (data)       => api.post('/offering', data),
  update:      (id, data)   => api.put(`/offering/${id}`, data),
  remove:      (id)         => api.delete(`/offering/${id}`),
  summary:     (params)     => api.get('/offering/summary', { params }),
}

export const budget = {
  fiscalYears:      ()       => api.get('/budget/fiscal-years'),
  categories:       (params) => api.get('/budget/categories', { params }),
  transactions:     (params) => api.get('/budget/transactions', { params }),
  addTransaction:   (data)   => api.post('/budget/transactions', data),
  removeTransaction:(id)     => api.delete(`/budget/transactions/${id}`),
  report:           (params) => api.get('/budget/report', { params }),
}

export const pastoral = {
  list:   (params) => api.get('/pastoral', { params }),
  add:    (data)   => api.post('/pastoral', data),
  update: (id, data) => api.put(`/pastoral/${id}`, data),
  remove: (id)     => api.delete(`/pastoral/${id}`),
}

export const calendar = {
  list:        (year, month) => api.get('/calendar', { params: { year, month } }),
  add:         (data)        => api.post('/calendar', data),
  remove:      (id)          => api.delete(`/calendar/${id}`),
  removeGroup: (groupId)     => api.delete(`/calendar/recurrence/${groupId}`),
}

export const messenger = {
  rooms:       (userId) => api.get('/messenger/rooms', { params: { user_id: userId } }),
  createRoom:  (data)   => api.post('/messenger/rooms', data),
  messages:    (roomId, params) => api.get(`/messenger/rooms/${roomId}/messages`, { params }),
  send:        (roomId, data)   => api.post(`/messenger/rooms/${roomId}/messages`, data),
  markRead:    (msgId, userId)  => api.post(`/messenger/messages/${msgId}/read`, { user_id: userId }),
}

export const sms = {
  logs: () => api.get('/sms'),
  send: (data) => api.post('/sms/send', data),
}

export const settings = {
  get:             ()      => api.get('/settings'),
  update:          (data)  => api.put('/settings', data),
  verifyMemberPin: (pin)   => api.post('/settings/verify-member-pin', { pin }),
}

export const expenses = {
  list:   (params)     => api.get('/expenses', { params }),
  add:    (data)       => api.post('/expenses', data),
  update: (id, data)   => api.put(`/expenses/${id}`, data),
  remove: (id)         => api.delete(`/expenses/${id}`),
}

const PUBLIC_BASE = import.meta.env.VITE_API_URL ?? '/api'
export const publicApi = {
  departments: () => fetch(`${PUBLIC_BASE}/public/departments`).then(r => r.json()),
  addExpense:  (data) => fetch(`${PUBLIC_BASE}/public/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json()),
}

export default api
