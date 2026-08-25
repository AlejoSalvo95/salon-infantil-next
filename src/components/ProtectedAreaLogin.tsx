type Props = {
  destination: "/plants" | "/flores" | "/seedlings";
  error?: string;
};

export function ProtectedAreaLogin({ destination, error }: Props) {
  return <main className="plants-login"><a className="plants-logo" href="/">☁ nube</a><section><p className="plants-kicker">Área privada</p><h1>Acceso<br/><em>compartido.</em></h1><p>Ingresá la clave de jardinería para acceder a plantas, flores y plantines.</p><form action="/api/plants/login" method="post"><input type="hidden" name="next" value={destination}/><label htmlFor="password">Clave de acceso</label><input id="password" name="password" type="password" autoComplete="current-password" required autoFocus/>{error && <span role="alert">La clave no es correcta.</span>}<button type="submit">Entrar al área privada <span>→</span></button></form></section><aside aria-hidden="true"><span>✿</span></aside></main>;
}
