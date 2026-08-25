export function Header({ onBook }: { onBook: () => void }) {
  return <><div className="announcement">Spring garden sessions are open · Reserve with a 20% deposit</div><header><a className="logo" href="#home"><span>☁</span> nube</a><nav><a href="#garden">The garden</a><a href="#programs">Programs</a><a href="#stories">Happy growers</a></nav><button className="nav-cta" onClick={onBook}>Check a date <span>↗</span></button><button className="menu" aria-label="Open menu">☰</button></header></>;
}
