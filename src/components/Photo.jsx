import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// URL for a stored submission photo (Supabase signed URL or demo IndexedDB blob).
// Returns { url, loading }; url stays null if the photo is missing.
export function usePhotoUrl(path) {
  const [state, setState] = useState({ url: null, loading: !!path });
  useEffect(() => {
    let alive = true;
    setState({ url: null, loading: !!path });
    if (path) {
      api.mediaUrl(path)
        .then((u) => alive && setState({ url: u, loading: false }))
        .catch(() => alive && setState({ url: null, loading: false }));
    }
    return () => { alive = false; };
  }, [path]);
  return state;
}

// Full-screen viewer. Esc / click outside closes; the photo can be opened in a new tab to zoom further.
export function Lightbox({ src, alt, caption, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(10,20,15,.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10 }}>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 90px)', objectFit: 'contain', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }} />
      <div className="row" style={{ gap: 14, color: '#FBF6EA', fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
        {caption && <span style={{ opacity: 0.85 }}>{caption}</span>}
        <a href={src} target="_blank" rel="noreferrer" style={{ color: '#E3A92B', fontWeight: 700 }}>Buka ukuran penuh ↗</a>
        <button onClick={onClose} style={{ color: '#FBF6EA', fontWeight: 700 }}>Tutup ✕</button>
      </div>
    </div>
  );
}

// Thumbnail that opens the lightbox. Shows a striped placeholder when there's no stored photo.
export function PhotoThumb({ path, name, caption, height = 140, rounded = 12, placeholder = 'Foto tidak tersimpan' }) {
  const { url, loading } = usePhotoUrl(path);
  const [open, setOpen] = useState(false);
  if (!url) {
    return (
      <div className="placeholder-stripes" style={{ height, borderRadius: rounded, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, color: '#6B665A', fontSize: 11, textAlign: 'center', padding: 8 }}>
        <span className="mono" style={{ fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'tanpa foto'}</span>
        <span>{loading ? 'Memuat foto…' : placeholder}</span>
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Lihat foto ${name || ''}`.trim()}
        style={{ display: 'block', width: '100%', height, borderRadius: rounded, overflow: 'hidden', background: '#14281F', padding: 0, position: 'relative' }}>
        <img src={url} alt={name || 'Foto submission'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <span style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 11, fontWeight: 700, color: '#FBF6EA', background: 'rgba(20,40,31,.7)', padding: '3px 8px', borderRadius: 999 }}>⤢ Perbesar</span>
      </button>
      {open && <Lightbox src={url} alt={name || 'Foto submission'} caption={caption} onClose={() => setOpen(false)} />}
    </>
  );
}
