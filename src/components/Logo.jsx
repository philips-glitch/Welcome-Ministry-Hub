// Flourish Hub logo, redrawn as SVG from design/flourish-hub-logo.webp:
// yellow sun, dark-green block, light-green leaf, cream sprout.
// `gap` is the colour of the thin outline that separates the sprout from the leaf —
// set it to the background the logo sits on.
const C = { sun: '#F4C14F', block: '#1E6B49', leaf: '#6DB553', sprout: '#FBF6EA' };

export function LogoMark({ size = 34, gap = '#14281F', title = 'Flourish Hub' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title} style={{ flex: 'none', display: 'block' }}>
      <circle cx="39" cy="11" r="9.5" fill={C.sun} />
      <path d="M22 24h14c6 0 10 4 10 10v54H22C10 88 2 80 2 68V44c0-11 9-20 20-20z" fill={C.block} />
      <path d="M45 56c0-27 17-45 47-47 5 0 8 3 7 8-3 28-19 43-45 45z" fill={C.leaf} />
      <g fill={C.sprout} stroke={gap} strokeWidth="3" strokeLinejoin="round">
        <path d="M49 64C49 46 37 34 13 34 13 53 26 64 49 64z" />
        <path d="M49 64C49 46 61 34 85 34 85 53 72 64 49 64z" />
      </g>
      <path d="M49 58v29" stroke={C.sprout} strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ size = 34, gap, color = '#FBF6EA', sub, subColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.3 }}>
      <LogoMark size={size} gap={gap} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ font: `800 ${Math.round(size * 0.5)}px/1.05 'Bricolage Grotesque', sans-serif`, color, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>Flourish Hub</span>
        {sub && <span style={{ fontSize: Math.max(11, Math.round(size * 0.3)), color: subColor || color, opacity: subColor ? 1 : 0.7 }}>{sub}</span>}
      </div>
    </div>
  );
}
