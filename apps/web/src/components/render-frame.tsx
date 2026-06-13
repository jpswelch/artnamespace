"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeneratedOutput } from "@/lib/art/types";

type RenderMessage =
  | {
      type: "artnamespace:rendered";
      id: string;
      dataUrl: string;
      features: Record<string, string>;
      console: string[];
    }
  | {
      type: "artnamespace:error";
      id: string;
      message: string;
      console: string[];
    };

export function RenderFrame({
  sketch,
  params,
  seed,
  tokenId,
  artistENS,
  collectionENS,
  artworkENS,
  onRendered,
  compact = false,
}: {
  sketch: string;
  params: Record<string, unknown>;
  seed: `0x${string}`;
  tokenId: number;
  artistENS: string;
  collectionENS: string;
  artworkENS: string;
  onRendered?: (output: GeneratedOutput) => void;
  compact?: boolean;
}) {
  const id = useMemo(() => `render-${tokenId}-${seed.slice(2, 14)}`, [seed, tokenId]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);

  const srcDoc = useMemo(
    () => buildSrcDoc({ id, sketch, params, seed, tokenId, artistENS, collectionENS, artworkENS }),
    [artistENS, artworkENS, collectionENS, id, params, seed, sketch, tokenId],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setError("Render timed out");
    }, 7000);

    function handleMessage(event: MessageEvent<RenderMessage>) {
      if (!event.data || event.data.id !== id) return;
      window.clearTimeout(timeout);

      if (event.data.type === "artnamespace:error") {
        setError(event.data.message);
        return;
      }

      setImage(event.data.dataUrl);
      onRendered?.({
        seed,
        params,
        dataUrl: event.data.dataUrl,
        features: event.data.features,
        console: event.data.console,
      });
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };
  }, [id, onRendered, params, seed]);

  return (
    <div className="relative aspect-square overflow-hidden border border-line bg-white">
      {!image && !error ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-neutral-500">Rendering</div>
      ) : null}
      {error ? <div className="absolute inset-0 grid place-items-center p-4 text-sm text-red-700">{error}</div> : null}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        title={`Render ${artworkENS}`}
        className={compact ? "h-full w-full scale-100" : "h-full w-full"}
      />
    </div>
  );
}

function buildSrcDoc(input: {
  id: string;
  sketch: string;
  params: Record<string, unknown>;
  seed: `0x${string}`;
  tokenId: number;
  artistENS: string;
  collectionENS: string;
  artworkENS: string;
}) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fffdf8} canvas{display:block;width:100%!important;height:100%!important}</style>
  <script src="/vendor/p5.min.js"></script>
</head>
<body>
<script>
const RENDER_ID = ${JSON.stringify(input.id)};
const params = ${JSON.stringify(input.params)};
const seed = ${JSON.stringify(input.seed)};
const tokenId = ${JSON.stringify(input.tokenId)};
const artistENS = ${JSON.stringify(input.artistENS)};
const collectionENS = ${JSON.stringify(input.collectionENS)};
const artworkENS = ${JSON.stringify(input.artworkENS)};
const logs = [];
console.log = (...args) => logs.push(args.map(String).join(" "));
console.error = (...args) => logs.push("error: " + args.map(String).join(" "));
function prng(hex) {
  let state = parseInt(hex.slice(2, 10), 16) || 1831565813;
  return function() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function send(type, payload) {
  parent.postMessage(Object.assign({ type, id: RENDER_ID, console: logs }, payload), "*");
}
window.addEventListener("error", event => send("artnamespace:error", { message: event.message }));
try {
${input.sketch}
  const rand = prng(seed);
  if (!window.ArtNamespace || typeof window.ArtNamespace.draw !== "function") {
    throw new Error("window.ArtNamespace.draw(ctx) is required");
  }
  new window.p5((p5) => {
    const ctx = { p5, seed, rand, params, tokenId, artistENS, collectionENS, artworkENS };
    p5.setup = () => {
      if (window.ArtNamespace.setup) window.ArtNamespace.setup(ctx);
      window.ArtNamespace.draw(ctx);
      const features = window.ArtNamespace.features ? window.ArtNamespace.features(ctx) : {};
      window.setTimeout(() => {
        send("artnamespace:rendered", { dataUrl: p5.canvas.toDataURL("image/png"), features });
      }, 50);
      p5.noLoop();
    };
    p5.draw = () => {};
  });
} catch (error) {
  send("artnamespace:error", { message: error && error.message ? error.message : String(error) });
}
</script>
</body>
</html>`;
}
