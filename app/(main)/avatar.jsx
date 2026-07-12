// Avatar sa slikom ili inicijalom kao fallbackom. Radi i u server i u
// client komponentama (nema state-a).
export default function Avatar({ username, avatarUrl, size = 32, className = "" }) {
  const style = { width: size, height: size };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={style}
        className={`shrink-0 rounded-full border border-white/10 object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={{ ...style, fontSize: Math.round(size * 0.45) }}
      className={`flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] font-display leading-none text-muted ${className}`}
    >
      {username?.[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
