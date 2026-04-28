const TARGET_MAX = 50 * 1024   // 50 kb
const TARGET_MIN = 10 * 1024   // 10 kb

const CONFIGS = [
  { maxSide: 1200, quality: 0.78 },
  { maxSide: 1000, quality: 0.68 },
  { maxSide:  900, quality: 0.58 },
  { maxSide:  800, quality: 0.48 },
  { maxSide:  700, quality: 0.38 },
  { maxSide:  600, quality: 0.30 },
  { maxSide:  500, quality: 0.24 },
  { maxSide:  400, quality: 0.20 },
]

function fitDimensions(w, h, maxSide) {
  if (w <= maxSide && h <= maxSide) return { w, h }
  return w > h
    ? { w: maxSide, h: Math.round(h * maxSide / w) }
    : { w: Math.round(w * maxSide / h), h: maxSide }
}

function estimateBytes(dataUrl) {
  return Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75)
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

function drawToCanvas(img, w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.filter = 'saturate(82%)'   // 채도 약간 감소 → 압축률 향상, 육안으로 거의 차이 없음
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

// 10~50kb 범위 안에 들어올 때까지 단계적으로 해상도·품질 낮춤
export function compressToTarget(file) {
  return fileToImage(file).then(img => {
    for (const { maxSide, quality } of CONFIGS) {
      const { w, h } = fitDimensions(img.width, img.height, maxSide)
      const canvas = drawToCanvas(img, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      const bytes = estimateBytes(dataUrl)
      if (bytes <= TARGET_MAX) return { dataUrl, bytes }
    }
    // 마지막 단계에서도 초과하면 최저 설정으로 강제 반환
    const { w, h } = fitDimensions(img.width, img.height, 400)
    const canvas = drawToCanvas(img, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.18)
    return { dataUrl, bytes: estimateBytes(dataUrl) }
  })
}

export { compressToTarget as compressOnly }
