"use client"

import { useState } from "react"
import { ExternalLink, Play, PlayCircle } from "lucide-react"
import { youtubeId, type ManualVideo } from "@/lib/escalas/manual"
import { EmptyState } from "./empty-state"

/** Vídeos indicados: YouTube vira player (carregado só ao tocar); outros links abrem em nova aba */
export function VideosTab({ items }: { items: ManualVideo[] }) {
  if (items.length === 0) {
    return <EmptyState icon={PlayCircle} title="Nenhum vídeo indicado ainda" description="Os vídeos recomendados pelo líder para esta área aparecem aqui." />
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  )
}

function VideoCard({ video }: { video: ManualVideo }) {
  const [playing, setPlaying] = useState(false)
  const id = youtubeId(video.url)

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      {id ? (
        <div className="relative aspect-video bg-black">
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0" aria-label={`Assistir: ${video.title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-90 group-hover:opacity-100" loading="lazy" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white transition-transform group-hover:scale-105">
                  <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
                </span>
              </span>
            </button>
          )}
        </div>
      ) : null}
      <div className="p-4 space-y-1.5">
        <h3 className="font-medium leading-snug break-words">{video.title}</h3>
        {video.description && <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{video.description}</p>}
        {!id && (
          <a href={video.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ExternalLink className="h-4 w-4" />
            Abrir link
          </a>
        )}
      </div>
    </article>
  )
}
