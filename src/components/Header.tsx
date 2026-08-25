export function Header({ onBook }: { onBook: () => void }) {
  return <><div className="announcement">Spring garden sessions are open · Reserve with a 20% deposit</div><header><a className="logo" href="#inicio"><span>☁</span> nube</a><nav><a href="#espacio">The garden</a><a href="#paquetes">Programs</a><a href="#opiniones">Happy growers</a></nav><button className="nav-cta" onClick={onBook}>Check a date <span>↗</span></button><button className="menu" aria-label="Open menu">☰</button></header></>;
}
