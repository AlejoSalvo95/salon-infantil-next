import { readChannelFormats, type FormatEvidence } from "./youtube-formats";
export type YouTubeApiResponse = { resource: string; params: Record<string, string>; status: number; body: unknown };
export type YouTubeVideoMetric = { uploadDate: string | null; viewCount: number | null; likeCount: number | null; commentCount: number | null; duration: number | null; title: string; url: string };
export type YouTubeChannelMetrics = { channel: string; country: string | null; subscriberCount: number | null; hiddenSubscriberCount: boolean; shorts: YouTubeVideoMetric[]; videos: YouTubeVideoMetric[]; fetchedAt: string; unclassified: YouTubeVideoMetric[]; classification: "channel-tabs"; formatEvidence: FormatEvidence[]; rawResponses: YouTubeApiResponse[] };
type ChannelIdentifier = { kind: "forHandle" | "id" | "forUsername"; value: string; canonical: string };
type ApiError = { error?: { message?: string } };
type ChannelResponse = ApiError & { items?: Array<{ snippet?: { country?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } }; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }> };
type PlaylistResponse = ApiError & { nextPageToken?: string; items?: Array<{ contentDetails?: { videoId?: string } }> };
type VideosResponse = ApiError & { items?: Array<{ id: string; snippet?: { publishedAt?: string; title?: string }; contentDetails?: { duration?: string }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }> };

function channelIdentifier(input: string): ChannelIdentifier {
  const value = input.trim();
  const directHandle = value.match(/^@([A-Za-z0-9._-]{3,100})$/)?.[1];
  if (directHandle) return { kind: "forHandle", value: directHandle, canonical: `https://www.youtube.com/@${directHandle}` };
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Ingresá un @handle o una URL válida de YouTube."); }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!["youtube.com", "m.youtube.com"].includes(host)) throw new Error("La URL debe pertenecer a youtube.com.");
  const handle = url.pathname.match(/^\/@([^/]+)/)?.[1];
  if (handle) return { kind: "forHandle", value: handle, canonical: `https://www.youtube.com/@${handle}` };
  const id = url.pathname.match(/^\/channel\/([^/]+)/)?.[1];
  if (id) return { kind: "id", value: id, canonical: `https://www.youtube.com/channel/${id}` };
  const username = url.pathname.match(/^\/user\/([^/]+)/)?.[1];
  if (username) return { kind: "forUsername", value: username, canonical: `https://www.youtube.com/user/${username}` };
  throw new Error("Usá el @handle o la URL /channel/ del canal.");
}

function apiKey() { const key = process.env.YOUTUBE_API_KEY?.trim(); if (!key) throw new Error("Falta configurar YOUTUBE_API_KEY en el servidor."); return key; }
async function youtubeApi<T extends ApiError>(resource: string, params: Record<string, string>, rawResponses: YouTubeApiResponse[]) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  Object.entries({ ...params, key: apiKey() }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json() as T;
  rawResponses.push({ resource, params: { ...params }, status: response.status, body });
  if (!response.ok) throw new Error(body.error?.message || `YouTube API respondió con estado ${response.status}.`);
  return body;
}
function isoDurationSeconds(value?: string) { if (!value) return null; const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/); if (!match) return null; return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0); }
function count(value?: string) { if (value === undefined) return null; const parsed = Number(value); return Number.isSafeInteger(parsed) ? parsed : null; }
async function resolveChannel(identifier: ChannelIdentifier, rawResponses: YouTubeApiResponse[]) { const response = await youtubeApi<ChannelResponse>("channels", { part: "snippet,contentDetails,statistics", [identifier.kind]: identifier.value }, rawResponses); const channel = response.items?.[0], playlist = channel?.contentDetails?.relatedPlaylists?.uploads; if (!playlist) throw new Error("No se encontró el canal o su lista de publicaciones públicas."); return { playlist, country: channel?.snippet?.country ?? null, subscriberCount: count(channel?.statistics?.subscriberCount), hiddenSubscriberCount: channel?.statistics?.hiddenSubscriberCount ?? false }; }
async function loadVideoIds(playlistId: string, rawResponses: YouTubeApiResponse[]) {
  const ids: string[] = []; let pageToken = ""; const limit = Math.min(Math.max(Number(process.env.YOUTUBE_MAX_VIDEOS) || 500, 1), 5000);
  do { const response = await youtubeApi<PlaylistResponse>("playlistItems", { part: "contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) }, rawResponses); for (const item of response.items ?? []) { const id = item.contentDetails?.videoId; if (id) ids.push(id); if (ids.length >= limit) return ids; } pageToken = response.nextPageToken ?? ""; } while (pageToken);
  return ids;
}
async function loadVideos(ids: string[], rawResponses: YouTubeApiResponse[]) {
  const videos: YouTubeVideoMetric[] = [];
  for (let index = 0; index < ids.length; index += 50) { const response = await youtubeApi<VideosResponse>("videos", { part: "snippet,contentDetails,statistics", id: ids.slice(index, index + 50).join(",") }, rawResponses); for (const item of response.items ?? []) videos.push({ uploadDate: item.snippet?.publishedAt?.slice(0, 10).replaceAll("-", "") ?? null, viewCount: count(item.statistics?.viewCount), likeCount: count(item.statistics?.likeCount), commentCount: count(item.statistics?.commentCount), duration: isoDurationSeconds(item.contentDetails?.duration), title: item.snippet?.title ?? "Video sin título", url: `https://www.youtube.com/watch?v=${item.id}` }); }
  return videos;
}
export async function getYouTubeChannelMetrics(input: string): Promise<YouTubeChannelMetrics> {
  const rawResponses: YouTubeApiResponse[] = [];
  const identifier = channelIdentifier(input), channel = await resolveChannel(identifier, rawResponses);
  const ids = await loadVideoIds(channel.playlist, rawResponses);
  const [items, formatEvidence] = await Promise.all([loadVideos(ids, rawResponses), readChannelFormats(identifier.canonical, ids)]);
  const shortIds = new Set(formatEvidence.filter((entry) => entry.tab === "shorts").flatMap((entry) => entry.ids));
  const videoIds = new Set(formatEvidence.filter((entry) => entry.tab !== "shorts").flatMap((entry) => entry.ids));
  const shorts: YouTubeVideoMetric[] = [], videos: YouTubeVideoMetric[] = [], unclassified: YouTubeVideoMetric[] = [];
  for (const item of items) {
    const id = new URL(item.url).searchParams.get("v")!;
    if (shortIds.has(id) && !videoIds.has(id)) shorts.push({ ...item, url: `https://www.youtube.com/shorts/${id}` });
    else if (videoIds.has(id) && !shortIds.has(id)) videos.push(item);
    else unclassified.push(item);
  }
  return { channel: identifier.canonical, country: channel.country, subscriberCount: channel.subscriberCount, hiddenSubscriberCount: channel.hiddenSubscriberCount, shorts, videos, unclassified, fetchedAt: new Date().toISOString(), classification: "channel-tabs", formatEvidence, rawResponses };
}