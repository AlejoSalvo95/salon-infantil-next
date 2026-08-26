type Section = "plants" | "flowers" | "seedlings";

const links: { href: string; label: string; section: Section }[] = [
  { href: "/plants", label: "Growth", section: "plants" },
  { href: "/flowers", label: "Flowers", section: "flowers" },
  { href: "/seedlings", label: "Seedlings", section: "seedlings" },
];

export function PrivateAreaNav({ current }: { current: Section }) {
  return <div className="private-area-actions"><nav className="private-area-nav" aria-label="Private garden sections">{links.map((link) => <a key={link.section} href={link.href} aria-current={current === link.section ? "page" : undefined}>{link.label}</a>)}</nav><form action="/api/plants/logout" method="post"><button type="submit">Sign out</button></form></div>;
}
