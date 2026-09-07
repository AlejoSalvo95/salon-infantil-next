type Node = Record<string, any>;
export type FormatEvidence = { tab: string; pages: number; ids: string[]; complete: boolean; error?: string };
export function readTabItems(root: unknown) {
  const ids = new Set<string>();
  const tokens = new Set<string>();
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const node = value as Node;
    const id = node.videoRenderer?.videoId ?? node.gridVideoRenderer?.videoId ?? node.reelItemRenderer?.videoId ?? node.reelWatchEndpoint?.videoId ?? (node.lockupViewModel?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" ? node.lockupViewModel.contentId : undefined);
    if (typeof id === "string" && /^[\w-]{11}$/.test(id)) ids.add(id);
    const token = node.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    if (typeof token === "string") tokens.add(token);
    Object.values(node).forEach(walk);
  };
  walk(root);
  return { ids: [...ids], tokens: [...tokens] };
}

export async function readChannelFormats(channelUrl: string, wantedIds: string[]) {
  const wanted = new Set(wantedIds);
  const signal = AbortSignal.timeout(25000);
  const evidence = await Promise.all(["shorts", "videos", "streams"].map(async (tab): Promise<FormatEvidence> => {
    const result: FormatEvidence = { tab, pages: 0, ids: [], complete: false };
    const found = new Set<string>();
    try {
      const response = await fetch(`${channelUrl}/${tab}?hl=en`, { signal, cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const match = html.match(/(?:var\s+)?ytInitialData\s*=\s*(\{[\s\S]*?\});/);
      if (!match) throw new Error("No se recibieron datos públicos de la pestaña");
      const initial = JSON.parse(match[1]);
      const tabs = initial.contents?.twoColumnBrowseResultsRenderer?.tabs;
      const selected = tabs?.find((entry: Node) => entry.tabRenderer?.selected)?.tabRenderer;
      const selectedUrl = selected?.endpoint?.commandMetadata?.webCommandMetadata?.url;
      if (typeof selectedUrl !== "string" || !selectedUrl.split("?")[0].endsWith(`/${tab}`)) throw new Error("YouTube no mostró la pestaña solicitada");
      let content = selected.content;
      const version = html.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1];
      const seenTokens = new Set<string>();
      for (let page = 0; page < 25; page++) {
        result.pages++;
        const parsed = readTabItems(content);
        parsed.ids.forEach((id) => found.add(id));
        const token = parsed.tokens.find((value) => !seenTokens.has(value));
        if (!parsed.tokens.length) { result.complete = true; break; }
        if (!token || !version || [...wanted].every((id) => found.has(id))) break;
        seenTokens.add(token);
        const next = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
          method: "POST", signal, cache: "no-store", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: version, hl: "en" } }, continuation: token }),
        });
        if (!next.ok) throw new Error(`Continuación HTTP ${next.status}`);
        const body = await next.json();
        content = (body.onResponseReceivedActions ?? body.onResponseReceivedEndpoints ?? []).flatMap((action: Node) => action.appendContinuationItemsAction?.continuationItems ?? action.reloadContinuationItemsCommand?.continuationItems ?? []);
        if (!content.length) throw new Error("Continuación sin contenido reconocible");
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : "No se pudo leer la pestaña";
    }
    result.ids = [...found];
    return result;
  }));
  return evidence;
}