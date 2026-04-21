import { useEffect, useRef, useState } from 'react'
import { messenger as api } from '../../api'
import dayjs from 'dayjs'

const ME = 1 // TODO: 실제 JWT에서 user_id 파싱

export default function Messenger() {
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    api.rooms(ME).then(r => setRooms(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!activeRoom) return
    api.messages(activeRoom.id).then(r => setMessages(r.data)).catch(() => {})
  }, [activeRoom])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async e => {
    e.preventDefault()
    if (!body.trim()) return
    const res = await api.send(activeRoom.id, { sender_id: ME, body })
    setMessages(m => [...m, res.data])
    setBody('')
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 96px)', gap: 0, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
      {/* 채팅방 목록 */}
      <div style={{ width: 240, borderRight: '1px solid #f1f5f9', overflow: 'y', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', fontWeight: 700, borderBottom: '1px solid #f1f5f9' }}>메신저</div>
        {rooms.map(r => (
          <div key={r.id} onClick={() => setActiveRoom(r)}
            style={{ padding: '12px 16px', cursor: 'pointer', background: activeRoom?.id === r.id ? '#eff6ff' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.name ?? `채팅방 ${r.id}`}</div>
            {r.last_message && <div style={{ fontSize: '0.78rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.last_message}</div>}
          </div>
        ))}
        {rooms.length === 0 && <div style={{ color: '#94a3b8', padding: 20, fontSize: '0.82rem' }}>채팅방이 없습니다.</div>}
      </div>

      {/* 메시지 영역 */}
      {activeRoom ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{activeRoom.name ?? `채팅방 ${activeRoom.id}`}</div>
          <div style={{ flex: 1, overflow: 'y', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map(m => {
              const isMe = m.sender_id === ME
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
                  {!isMe && <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#64748b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0 }}>{m.sender_name?.[0]}</div>}
                  <div>
                    {!isMe && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 2 }}>{m.sender_name}</div>}
                    <div style={{ background: isMe ? '#3b82f6' : '#f1f5f9', color: isMe ? '#fff' : '#1e293b', borderRadius: isMe ? '12px 4px 12px 12px' : '4px 12px 12px 12px', padding: '8px 12px', fontSize: '0.875rem', maxWidth: 320 }}>
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
          <form onSubmit={handleSend} style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
            <input value={body} onChange={e => setBody(e.target.value)} placeholder="메시지 입력..."
              style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.875rem', outline: 'none' }} />
            <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>전송</button>
          </form>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>채팅방을 선택하세요.</div>
      )}
    </div>
  )
}
