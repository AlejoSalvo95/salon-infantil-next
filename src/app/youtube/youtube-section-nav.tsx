type YouTubeSection = "analytics" | "milestones";

const links: { href: string; label: string; section: YouTubeSection }[] = [
  { href: "/youtube/analytics", label: "Analytics", section: "analytics" },
  { href: "/youtube/milestones", label: "Milestones", section: "milestones" },
];

export function YouTubeSectionNav({ current }: { current: YouTubeSection }) {
  return <nav className="youtube-section-nav" aria-label="YouTube sections">{links.map((link) => <a key={link.section} href={link.href} aria-current={current === link.section ? "page" : undefined}>{link.label}</a>)}</nav>;
}
