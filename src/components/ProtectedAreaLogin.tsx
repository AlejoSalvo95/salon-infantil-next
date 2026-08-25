type Props = {
  destination: "/plants" | "/flores" | "/seedlings";
  error?: string;
};

export function ProtectedAreaLogin({ destination, error }: Props) {
  return <main className="plants-login"><a className="plants-logo" href="/">☁ nube</a><section><p className="plants-kicker">Private garden</p><h1>One key.<br/><em>Every garden.</em></h1><p>Enter the garden key to access plants, flowers, and seedlings.</p><form action="/api/plants/login" method="post"><input type="hidden" name="next" value={destination}/><label htmlFor="password">Garden access key</label><input id="password" name="password" type="password" autoComplete="current-password" required autoFocus/>{error && <span role="alert">The garden key is incorrect.</span>}<button type="submit">Enter the private garden <span>→</span></button></form></section><aside aria-hidden="true"><span>✿</span></aside></main>;
}
