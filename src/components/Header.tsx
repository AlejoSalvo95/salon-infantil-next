export function Header({ onBook }: { onBook: () => void }) {
  return <><div className="announcement">Agenda primavera abierta · Reservá con 20% de seña</div><header><a className="logo" href="#inicio"><span>☁</span> nube</a><nav><a href="#espacio">El espacio</a><a href="#paquetes">Paquetes</a><a href="#opiniones">Familias felices</a></nav><button className="nav-cta" onClick={onBook}>Consultar fecha <span>↗</span></button><button className="menu" aria-label="Abrir menú">☰</button></header></>;
}
