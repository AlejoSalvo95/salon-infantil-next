import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ProtectedAreaLogin } from "@/components/ProtectedAreaLogin";
import { PrivateAreaNav } from "@/components/PrivateAreaNav";
import { isPlantsSessionValid, PLANTS_COOKIE } from "@/lib/plants-auth";
import { YouTubeSectionNav } from "../youtube-section-nav";
import "../../plants/plants.css";
import "../youtube.css";

export const metadata: Metadata = {
  title: "YouTube milestones · Nube",
  description: "Hitos del canal de Heath Claydon.",
};
export const dynamic = "force-dynamic";

const milestones = [
  { date: "2026-09-02", icon: "★", title: "My first subscriber", description: "The first person joined the channel. One subscriber, and the beginning of a community." },
  { date: "2026-08-30", icon: "▶", title: "I uploaded my first Short", description: "The channel took its first public step with its first Short." },
];

const milestoneDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function YouTubeMilestonesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  if (!isPlantsSessionValid(cookieStore.get(PLANTS_COOKIE)?.value)) {
    const { error } = await searchParams;
    return <ProtectedAreaLogin destination="/youtube/milestones" error={error} />;
  }
  return <main className="youtube-page milestones-page"><header className="youtube-header"><a className="plants-logo" href="/">☁ nube</a><PrivateAreaNav current="youtube" /></header><YouTubeSectionNav current="milestones"/><section className="milestones-intro"><div><p className="youtube-kicker">Worth mentioning</p><h1>Small wins.<br/><em>Big story.</em></h1></div><div><p>A place to remember every first, every leap, and every moment that made the channel feel real.</p><a href="https://www.youtube.com/@heathclaydon/featured" target="_blank" rel="noreferrer">Visit @heathclaydon ↗</a></div></section><section className="milestones-summary" aria-label="Milestone summary"><span>{milestones.length}</span><p>moments worth remembering<br/>since 30 August 2026</p></section><ol className="milestone-timeline">{milestones.map((milestone, index) => <li key={milestone.date}><div className="milestone-date"><span>{milestoneDate.format(new Date(`${milestone.date}T12:00:00`))}</span><small>Milestone {milestones.length - index}</small></div><div className="milestone-marker" aria-hidden="true"><span>{milestone.icon}</span></div><article><p className="youtube-kicker">Channel milestone</p><h2>{milestone.title}</h2><p>{milestone.description}</p></article></li>)}</ol></main>;
}
