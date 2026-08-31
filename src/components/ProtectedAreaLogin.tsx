type Props = {
  destination: "/plants" | "/flowers" | "/seedlings" | "/youtube";
  error?: string;
};

export function ProtectedAreaLogin({ destination, error }: Props) {
  return <main className="plants-login"><a className="plants-logo" href="/">☁ nube</a><section><p className="plants-kicker">Private area</p><h1>One key.<br/><em>Every tool.</em></h1><p>Enter the private key to access garden tracking and YouTube metrics.</p><form action="/api/plants/login" method="post"><input type="hidden" name="next" value={destination}/><label htmlFor="password">Private access key</label><input id="password" name="password" type="password" autoComplete="current-password" required autoFocus/>{error && <span role="alert">The access key is incorrect.</span>}<button type="submit">Enter the private area <span>→</span></button></form></section><aside aria-hidden="true"><span>✿</span></aside></main>;
}
