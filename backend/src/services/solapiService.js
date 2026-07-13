import { SolapiMessageService } from 'solapi'

/**
 * 솔라피(Solapi) 발송 클라이언트 — SMS/LMS + 카카오 알림톡을 하나의 벤더로 통합.
 * 환경변수: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER, SOLAPI_KAKAO_PF_ID
 */
function getClient() {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  if (!apiKey || !apiSecret) return null
  return new SolapiMessageService(apiKey, apiSecret)
}

/**
 * 일반 SMS/LMS 발송
 * @param {string[]} phones  정규화된 전화번호 배열
 * @param {string}   message 발송 메시지
 * @returns {{ ok: boolean, msgType: string, raw?: string, error?: string }}
 */
export async function sendSms(phones, message) {
  const client = getClient()
  const sender = process.env.SOLAPI_SENDER
  if (!client || !sender) {
    return { ok: false, msgType: 'SMS', error: '솔라피 환경변수 미설정 (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER)' }
  }

  const msgType = Buffer.byteLength(message, 'utf8') > 90 ? 'LMS' : 'SMS'

  try {
    const result = await client.send(
      phones.map(to => ({ to, from: sender, text: message }))
    )
    return { ok: true, msgType, raw: JSON.stringify(result) }
  } catch (err) {
    return { ok: false, msgType, error: err.message }
  }
}

/**
 * 카카오 알림톡 발송 (수신자별 개인화 변수 지원, 실패 시 SMS 대체발송 옵션)
 * @param {string[]} phones                정규화된 전화번호 배열
 * @param {string}   templateId            솔라피/카카오 알림톡 템플릿 코드
 * @param {string}   pfId                  카카오 발신프로필 키
 * @param {Map<string,Record<string,string>>} perRecipientVariables  전화번호 → {"#{변수}":"값"} 매핑
 * @param {{ disableSms?: boolean }} opts   disableSms=true면 카카오 실패 시에도 SMS 대체발송 안 함
 * @returns {{ ok: boolean, msgType: string, raw?: string, error?: string }}
 */
export async function sendAlimtalk(phones, templateId, pfId, perRecipientVariables, { disableSms = false } = {}) {
  const client = getClient()
  const sender = process.env.SOLAPI_SENDER
  if (!client || !sender) {
    return { ok: false, msgType: 'ALIMTALK', error: '솔라피 환경변수 미설정 (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER)' }
  }
  if (!pfId) {
    return { ok: false, msgType: 'ALIMTALK', error: '카카오 발신프로필 키(pfId) 미설정 (SOLAPI_KAKAO_PF_ID)' }
  }

  try {
    const result = await client.send(
      phones.map(to => ({
        to,
        from: sender,
        kakaoOptions: {
          pfId,
          templateId,
          variables: perRecipientVariables.get(to) ?? {},
          disableSms,
        },
      }))
    )
    return { ok: true, msgType: 'ALIMTALK', raw: JSON.stringify(result) }
  } catch (err) {
    return { ok: false, msgType: 'ALIMTALK', error: err.message }
  }
}

/**
 * 승인된 알림톡 템플릿 목록 조회 (Phase 2, 템플릿 상태 동기화용 — v1에서는 콘솔에서 수동 등록)
 */
export async function listAlimtalkTemplates() {
  const client = getClient()
  if (!client) return []
  const result = await client.getKakaoAlimtalkTemplates()
  return result?.templateList ?? []
}
