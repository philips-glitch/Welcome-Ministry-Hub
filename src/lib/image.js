// Shrink a photo in the browser before upload: longest side ≤ `max` px, re-encoded as JPEG.
// Phone photos (3–10 MB) usually end up 200–500 KB. If the browser can't decode the file
// (e.g. HEIC outside Safari) the original is returned unchanged.
export async function resizeImage(file, { max = 1600, quality = 0.82 } = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try { bitmap = await loadViaImg(file); } catch { return { file, resized: false }; }
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
  // Keep the original if re-encoding didn't make it smaller (already-small JPEGs).
  if (!blob || blob.size >= file.size) return { file, resized: false, width: w, height: h };
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return { file: new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }), resized: true, width: w, height: h };
}

function loadViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export const formatBytes = (n) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
