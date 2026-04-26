import jscanify from 'jscanify/client'

let cvLoadPromise = null

function loadOpenCV() {
  if (cvLoadPromise) return cvLoadPromise
  cvLoadPromise = new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js'
    script.async = true
    script.onload = () => {
      const t0 = Date.now()
      const poll = setInterval(() => {
        if (window.cv && window.cv.Mat) {
          clearInterval(poll)
          resolve()
        } else if (Date.now() - t0 > 20000) {
          clearInterval(poll)
          reject(new Error('OpenCV 초기화 타임아웃'))
        }
      }, 100)
    }
    script.onerror = () => reject(new Error('OpenCV 로드 실패'))
    document.head.appendChild(script)
  })
  return cvLoadPromise
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function fitDimensions(w, h, maxSide = 1400) {
  if (w <= maxSide && h <= maxSide) return { w, h }
  if (w > h) return { w: maxSide, h: Math.round(h * maxSide / w) }
  return { w: Math.round(w * maxSide / h), h: maxSide }
}

function applyEnhancements(srcCanvas) {
  const canvas = document.createElement('canvas')
  canvas.width = srcCanvas.width
  canvas.height = srcCanvas.height
  const ctx = canvas.getContext('2d')
  ctx.filter = 'grayscale(85%) contrast(135%) brightness(105%)'
  ctx.drawImage(srcCanvas, 0, 0)
  return canvas
}

function toDataUrl(canvas, quality = 0.72) {
  const webp = canvas.toDataURL('image/webp', quality)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality)
}

function estimateBytes(dataUrl) {
  return Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75)
}

export async function processImage(file) {
  const originalSize = file.size
  try {
    await loadOpenCV()
    const img = await fileToImage(file)
    const { w, h } = fitDimensions(img.width, img.height)

    let resultCanvas
    let scanned = false
    try {
      const scanner = new jscanify()
      resultCanvas = scanner.extractPaper(img, w, h)
      if (!resultCanvas || resultCanvas.width === 0 || resultCanvas.height === 0) throw new Error('empty')
      scanned = true
    } catch {
      resultCanvas = document.createElement('canvas')
      resultCanvas.width = w
      resultCanvas.height = h
      resultCanvas.getContext('2d').drawImage(img, 0, 0, w, h)
    }

    const enhanced = applyEnhancements(resultCanvas)
    const dataUrl = toDataUrl(enhanced)
    return { dataUrl, originalSize, processedSize: estimateBytes(dataUrl), scanned }
  } catch {
    try {
      const dataUrl = await compressOnly(file)
      return { dataUrl, originalSize, processedSize: estimateBytes(dataUrl), scanned: false }
    } catch {
      throw new Error('이미지 처리에 실패했습니다')
    }
  }
}

export function compressOnly(file) {
  return fileToImage(file).then(img => {
    const { w, h } = fitDimensions(img.width, img.height)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(img, 0, 0, w, h)
    return toDataUrl(canvas)
  })
}
