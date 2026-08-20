/**
 * 문자나라(munjanara.co.kr) 발송 클라이언트 — GET 기반 send.sys API, 수신자 1건당 1회 요청.
 * 환경변수: MUNJANARA_USERID, MUNJANARA_PASSWD, MUNJANARA_SENDER
 * https://munjanara.co.kr/send.sys?userid=..&passwd=..&sender=..&receiver=..&message=..
 */

const RESULT_CODES = {
  '9':  '성공',
  '1':  '필수전달값 누락',
  '2':  '존재하지 않는 아이디',
  '3':  '비밀번호 인증실패 (2차 비밀번호 확인)',
  '4':  '잔액 부족',
  '6':  '발신번호가 숫자로 이루어져 있지 않음',
  '7':  '사용 중지된 아이디',
  '11': '중복 전송 (짧은 시간 내 동일 발송)',
  '12': '발신번호 형식 오류',
  '13': '발신번호 사전등록 안됨',
  '14': '허용되지 않은 접속 IP',
  '15': '비정상적인 반복 접속',
  '16': '예약시간 설정 오류',
}

const CHUNK_SIZE = 5 // 동시요청 과다로 인한 "비정상적인 반복 접속(15)" 방지

function getCreds() {
  const userid = process.env.MUNJANARA_USERID
  const passwd = process.env.MUNJANARA_PASSWD
  const sender = process.env.MUNJANARA_SENDER
  if (!userid || !passwd || !sender) return null
  return { userid, passwd, sender }
}

async function sendOne(creds, receiver, message) {
  const params = new URLSearchParams({
    userid: creds.userid,
    passwd: creds.passwd,
    sender: creds.sender,
    receiver,
    message,
    encode: '1',
    allow_mms: '1', // 미설정 시 90byte 초과 메시지가 자동으로 잘림
    end_alert: '0',
  })
  const res = await fetch(`https://munjanara.co.kr/send.sys?${params.toString()}`)
  const text = (await res.text()).trim()
  const [code, money, sent, stype] = text.split('|')
  return { code, money, sent, stype, raw: text }
}

async function sendInChunks(creds, phones, message) {
  const results = []
  for (let i = 0; i < phones.length; i += CHUNK_SIZE) {
    const chunk = phones.slice(i, i + CHUNK_SIZE)
    const chunkResults = await Promise.all(
      chunk.map(phone =>
        sendOne(creds, phone, message)
          .then(r => ({ phone, ...r }))
          .catch(err => ({ phone, code: null, error: err.message }))
      )
    )
    results.push(...chunkResults)
  }
  return results
}

/**
 * 일반 SMS/LMS 발송 (카카오 알림톡 미지원 — 알림톡은 솔라피 전용)
 * @param {string[]} phones  정규화된 전화번호 배열
 * @param {string}   message 발송 메시지
 * @returns {{ ok: boolean, msgType: string, raw?: string, error?: string }}
 */
export async function sendSms(phones, message) {
  const creds = getCreds()
  if (!creds) {
    return { ok: false, msgType: 'SMS', error: '문자나라 환경변수 미설정 (MUNJANARA_USERID, MUNJANARA_PASSWD, MUNJANARA_SENDER)' }
  }

  const msgType = Buffer.byteLength(message, 'utf8') > 90 ? 'LMS' : 'SMS'

  try {
    const results = await sendInChunks(creds, phones, message)
    const failed = results.filter(r => r.code !== '9')
    const ok = failed.length === 0
    const error = failed.length
      ? failed.slice(0, 3).map(f => `${f.phone}: ${RESULT_CODES[f.code] ?? f.error ?? '알 수 없는 오류'}`).join(', ')
      : undefined
    return { ok, msgType, raw: JSON.stringify(results), error }
  } catch (err) {
    return { ok: false, msgType, error: err.message }
  }
}

/** 잔액 조회 */
export async function getBalance() {
  const creds = getCreds()
  if (!creds) return { ok: false, error: '문자나라 환경변수 미설정' }
  const params = new URLSearchParams({ call_type: '1', userid: creds.userid, passwd: creds.passwd })
  const res = await fetch(`https://munjanara.co.kr/send.sys?${params.toString()}`)
  const text = (await res.text()).trim()
  const [code, money] = text.split('|')
  if (code !== '9') return { ok: false, error: RESULT_CODES[code] ?? `알 수 없는 오류 (${code})` }
  return { ok: true, money: Number(money) }
}
