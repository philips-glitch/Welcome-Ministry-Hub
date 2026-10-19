import { useState } from 'react';
import { TRIVIA } from '../lib/trivia.js';
import { Confetti } from './motion.jsx';

// Mini Games: Trivia Alkitab, just for fun (no points, nothing saved). 10 random questions out of the bank.
const ROUND = 10;
const LETTERS = ['a', 'b', 'c', 'd'];

function pickRound() {
  const idx = TRIVIA.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, ROUND);
}

// 10 right → "Kamu Hebat Juga Ya!", 6–9 → "Ayo baca lagi Alkitabnya!", 0–5 → "Duhhhhh…".
export function verdict(right) {
  if (right === ROUND) return { title: 'Kamu Hebat Juga Ya!', emoji: '🏆', tone: '#2F7A55' };
  if (right >= 6) return { title: 'Ayo baca lagi Alkitabnya!', emoji: '📖', tone: '#B07A12' };
  return { title: 'Duhhhhh, Baca Alkitabnya sekarang gihh!', emoji: '😅', tone: '#9A2A1E' };
}

export default function MiniGames() {
  const [round, setRound] = useState(null);   // question indexes for this round
  const [at, setAt] = useState(0);            // current question
  const [picked, setPicked] = useState(null); // chosen option on the current question
  const [right, setRight] = useState(0);
  const [done, setDone] = useState(false);

  const start = () => { setRound(pickRound()); setAt(0); setPicked(null); setRight(0); setDone(false); };
  const choose = (i) => { if (picked != null) return; setPicked(i); if (i === TRIVIA[round[at]][2]) setRight((n) => n + 1); };
  const next = () => { if (at + 1 >= ROUND) setDone(true); else { setAt(at + 1); setPicked(null); } };

  if (!round) {
    return (
      <div className="p-stack" style={{ maxWidth: 620 }}>
        <div className="col" style={{ gap: 4 }}>
          <span className="p-title">Mini Games</span>
          <span className="muted" style={{ fontSize: 12 }}>Buat seru-seruan · tidak ada poin</span>
        </div>
        <section style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 24, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 34 }}>📖</span>
          <span style={{ font: "800 26px/1.15 'Bricolage Grotesque'" }}>Trivia Alkitab</span>
          <span style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>{ROUND} soal pilihan ganda, diambil acak dari {TRIVIA.length} soal Perjanjian Lama & Baru. Setiap kali main, soalnya beda. Seberapa kenal kamu dengan Alkitab?</span>
          <button className="p-btn-lg" onClick={start} style={{ background: '#E3A92B', color: '#1B2620' }}>Mulai main</button>
        </section>
      </div>
    );
  }

  const [question, options, answer] = TRIVIA[round[at]];
  const no = round[at] + 1;
  const v = done && verdict(right);
  return (
    <div className="p-stack" style={{ maxWidth: 620 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="p-title">Trivia Alkitab</span>
        <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Soal {at + 1}/{ROUND} · {right} benar</span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: ROUND }, (_, i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < at + (picked != null ? 1 : 0) ? '#2F7A55' : '#E9E0CC' }} />)}
      </div>
      <section className="p-card" style={{ borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em' }}>{no <= 100 ? 'PERJANJIAN LAMA' : 'PERJANJIAN BARU'}</span>
        <span style={{ font: "700 18px/1.4 'Bricolage Grotesque'" }}>{question}</span>
        <div className="col" style={{ gap: 8 }}>
          {options.map((o, i) => {
            const isAns = picked != null && i === answer;
            const isWrong = picked === i && i !== answer;
            return (
              <button key={i} onClick={() => choose(i)} disabled={picked != null} className="row"
                style={{ textAlign: 'left', gap: 10, padding: '12px 14px', borderRadius: 14, fontSize: 15, cursor: picked != null ? 'default' : 'pointer',
                  border: `1.5px solid ${isAns ? '#2F7A55' : isWrong ? '#C4533F' : '#DCD2BC'}`, background: isAns ? '#E3EFE6' : isWrong ? '#FBE4E0' : '#FFFDF8', color: '#1B2620' }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13,
                  background: isAns ? '#2F7A55' : isWrong ? '#C4533F' : '#EDE6D6', color: isAns || isWrong ? '#fff' : '#56655C' }}>{isAns ? '✓' : isWrong ? '✕' : LETTERS[i]}</span>
                <span style={{ flex: 1 }}>{o}</span>
              </button>
            );
          })}
        </div>
        {picked != null && (
          <div className="col" style={{ gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: picked === answer ? '#2F7A55' : '#9A2A1E' }}>
              {picked === answer ? 'Benar! 🎉' : `Kurang tepat. Jawabannya: ${LETTERS[answer]}. ${options[answer]}`}
            </span>
            <button className="p-btn-lg" onClick={next} style={{ background: '#1F4D3A', color: '#FBF6EA' }}>{at + 1 >= ROUND ? 'Lihat hasil' : 'Soal berikutnya'}</button>
          </div>
        )}
      </section>

      {done && (
        <div role="dialog" aria-modal="true" aria-label="Hasil trivia" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,40,31,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="p-card p-pop" style={{ position: 'relative', overflow: 'hidden', width: '100%', maxWidth: 400, borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            {right === ROUND && <Confetti />}
            <span style={{ fontSize: 48 }}>{v.emoji}</span>
            <span style={{ font: "800 24px/1.2 'Bricolage Grotesque'", color: v.tone }}>{v.title}</span>
            <span className="muted" style={{ fontSize: 14 }}>{right} dari {ROUND} soal benar</span>
            <button className="p-btn-lg" onClick={start} style={{ background: '#1F4D3A', color: '#FBF6EA', width: '100%', marginTop: 6 }}>Main lagi</button>
            <button className="link" onClick={() => setRound(null)} style={{ fontSize: 13 }}>Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
