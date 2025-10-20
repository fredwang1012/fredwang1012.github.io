import React, { useState } from "react";
import { Play, Pause } from "lucide-react";
import ReactPlayer from "react-player";
import { Link } from "react-router-dom";

const pieces = [
  {
    title: "Rachmaninov – Piano Concerto No. 3 in D minor, Op. 30",
    url: "https://www.youtube.com/watch?v=GvKQKnIVy1I&t=30s",
  },
  {
    title: "Rachmaninov – Piano Concerto No. 2 in C minor, Op. 18",
    url: "https://www.youtube.com/watch?v=e-x01ddG0x4&t=16s",
  },
  {
    title: "Liszt – Tre sonetti di Petrarca, S. 270 (Sonetto 104)",
    url: "https://www.youtube.com/watch?v=qtqmnnZhjfU&t=9s",
  },
];

const myPerformances = [
  {
    title: "Kreisler – Liebesleid (arr. Rachmaninov)",
    url: "https://www.youtube.com/shorts/G9iXslJz-vE",
  },
];

export default function MusicPage() {
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [modalUrl, setModalUrl] = useState(null);

  return (
    <div className="relative min-h-screen px-6 py-24 max-w-4xl mx-auto font-sans">
      <div className="blob-field" aria-hidden="true" />
      <h1 className="text-4xl font-bold mb-4 text-center">Music</h1>
      <p className="text-lg text-center mb-8 italic">A window into my passion for music.</p>

      <h2 className="text-2xl font-semibold mb-4">My personal ranking of favourite piano works:</h2>
      <ul className="space-y-4 mb-12">
        {pieces.map((p) => {
          const selected = audioUrl === p.url;
          const playing = selected && isPlaying;
          return (
            <li key={p.title} className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (audioUrl === p.url) {
                    setIsPlaying(!isPlaying);
                  } else {
                    setAudioUrl(p.url);
                    setIsPlaying(true);
                  }
                }}
                className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none"
                aria-label={playing ? "Pause recording" : "Play recording"}
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setModalUrl(
                  p.url
                    .replace("watch?v=", "embed/")
                    .replace("&t=", "?start=")
                    .replace(/s$/, "") +
                  "&autoplay=1"
                )}
                className="text-left text-blue-700 hover:underline"
              >
                {p.title}
              </button>
            </li>
          );
        })}
      </ul>

      <h2 className="text-2xl font-semibold mb-4">My Playing:</h2>
      <ul className="space-y-4 mb-12">
        {myPerformances.map((p) => {
          const selected = audioUrl === p.url;
          const playing = selected && isPlaying;
          return (
            <li key={p.title} className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (audioUrl === p.url) {
                    setIsPlaying(!isPlaying);
                  } else {
                    setAudioUrl(p.url);
                    setIsPlaying(true);
                  }
                }}
                className="p-3 rounded-full bg-green-600 text-white hover:bg-green-700 focus:outline-none"
                aria-label={playing ? "Pause recording" : "Play recording"}
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setModalUrl(
                  p.url
                    .replace("shorts/", "embed/")
                    .replace("watch?v=", "embed/")
                    .replace("&t=", "?start=")
                    .replace(/s$/, "") +
                  "?autoplay=1"
                )}
                className="text-left text-green-700 hover:underline"
              >
                {p.title}
              </button>
            </li>
          );
        })}
      </ul>

      <ReactPlayer url={audioUrl} playing={isPlaying} width={0} height={0} style={{ display: "none" }} />

      {modalUrl && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setModalUrl(null)}
        >
          <div
            className="w-full max-w-3xl aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={modalUrl}
              title="Music performance"
              className="w-full h-full"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      )}

      <p className="text-center text-gray-500 mb-12">Page under construction</p>

      <div className="text-center">
        <a
          href="/#music"
          className="inline-block px-5 py-3 rounded-2xl shadow hover:shadow-md transition bg-blue-600 text-white font-semibold"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
