// SWAMEK brand logo — stylized mark
export default function Logo({ size = 32, color = "#1A362D", bg = "#ffffff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-label="SWAMEK">
      <rect x="0" y="0" width="40" height="40" rx="4" fill={color}/>
      <path d="M12 14 Q12 10 16 10 L24 10 Q28 10 28 14 Q28 18 24 18 L16 18 Q12 18 12 22 Q12 26 16 26 L24 26 Q28 26 28 30"
        stroke={bg} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="31" cy="31" r="2.2" fill="#D46B4E"/>
    </svg>
  );
}
