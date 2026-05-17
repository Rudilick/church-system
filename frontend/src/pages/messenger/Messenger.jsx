import { useEffect, useRef, useState, useCallback } from 'react'
import { messenger as api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'

export default function Messenger() {
  const { user } = useAuth()
  const ME = user?.id

  const [rooms, setRooms]           = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages]     = useState([])
  const [body, setBody]             = useState('')
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [creating, setCreating]     = useState(false)
  const bottomRef  = useRef(null)
  const pollRef    = useRef(null)

  const loadRooms = useCallback(() => {
    if (!ME) return
    api.rooms(ME).then(r => setRooms(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [ME])

  useEffect(() => { loadRooms() }, [loadRooms])

  const loadMessages = useCallback((roomId) => {
    api.messages(roomId).then(r => {
      const msgs = Array.isArray(r.data) ? r.data : []
      setMessages(msgs)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    clearInterval(pollRef.current)
    if (!activeRoom) return
    loadMessages(activeRoom.id)
    pollRef.current = setInterval(() => loadMessages(activeRoom.id), 5000)
    return () => clearInterval(pollRef.current)
  }, [activeRoom, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async e => {
    e.preventDefault()
    if (!body.trim() || !ME) return
    try {
      const res = await api.send(activeRoom.id, { sender_id: ME, body })
      setMessages(m => [...m, res.data])
      setBody('')
      loadRooms()
    } catch {
      toast.error('전송 실패')
    }
  }

  const handleCreateRoom = async e => {
    e.preventDefault()
    if (!newRoomName.trim() || !ME) return
    setCreating(true)
    try {
      const res = await api.createRoom({ name: newRoomName.trim(), is_group: true, user_ids: [ME] })
      const newRoom = res.data
      setRooms(prev => [newRoom, ...prev])
      setActiveRoom(newRoom)
      setNewRoomName('')
      setShowNewRoom(false)
    } catch {
      toast.error('채팅방 생성 실패')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 96px)', gap: 0, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>

      {/* 채팅방 목록 */}
      <div style={{ width: 240, borderRight: '1px solid #f1f5f9', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', fontWeight: 700, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span>메신저</span>
          <button
            onClick={() => setShowNewRoom(v => !v)}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
          >+ 새 방</button>
        </div>

        {showNewRoom && (
          <form onSubmit={handleCreateRoom} style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 6, flexShrink: 0 }}>
            <input
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              placeholder="채팅방 이름"
              autoFocus
              style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', fontSize: '0.82rem', outline: 'none' }}
            />
            <button type="submit" disabled={creating || !newRoomName.trim()}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: '0.8rem', cursor: 'pointer' }}>
              생성
            </button>
          </form>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {rooms.map(r => (
            <div key={r.id} onClick={() => setActiveRoom(r)}
              style={{ padding: '12px 16px', cursor: 'pointer', background: activeRoom?.id === r.id ? '#eff6ff' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: activeRoom?.id === r.id ? '#2563eb' : '#1e293b' }}>{r.name ?? `채팅방 ${r.id}`}</div>
              {r.last_message && <div style={{ fontSize: '0.78rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{r.last_message}</div>}
            </div>
          ))}
          {rooms.length === 0 && <div style={{ color: '#94a3b8', padding: 20, fontSize: '0.82rem' }}>채팅방이 없습니다.<br />+ 새 방으로 시작하세요.</div>}
        </div>
      </div>

      {/* 메시지 영역 */}
      {activeRoom ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, flexShrink: 0 }}>
            {activeRoom.name ?? `채팅방 ${activeRoom.id}`}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map(m => {
              const isMe = m.sender_id === ME
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
                  {!isMe && (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#64748b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0 }}>
                      {m.sender_name?.[0] ?? '?'}
                    </div>
                  )}
                  <div style={{ maxWidth: 320 }}>
                    {!isMe && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>{m.sender_name}</div>}
                    <div style={{ background: isMe ? '#3b82f6' : '#f1f5f9', color: isMe ? '#fff' : '#1e293b', borderRadius: isMe ? '12px 4px 12px 12px' : '4px 12px 12px 12px', padding: '8px 12px', fontSize: '0.875rem', wordBreak: 'break-word' }}>
                      {m.body}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2, textAlign: isMe ? 'right' : 'left' }}>
                      {dayjs(m.created_at).format('HH:mm')}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSend} style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="메시지 입력... (Enter로 전송)"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
              style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.875rem', outline: 'none' }}
            />
            <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}>전송</button>
          </form>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
          채팅방을 선택하거나 새로 만드세요.
        </div>
      )}
    </div>
  )
}
