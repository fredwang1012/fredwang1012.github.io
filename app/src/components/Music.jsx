import React from "react";
import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";
import ReactPlayer from "react-player";
import { pieces } from "../data/music";

export default function Music() {
  const [audioUrl, setAudioUrl] = React.useState(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [modalUrl, setModalUrl] = React.useState(null);

  return (
    <section id="music" className="relative max-w-6xl mx-auto px-6 py-24 overflow-hidden">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-bold mb-8"
      >
        Music
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-lg leading-relaxed mb-8"
      >
        My personal ranking of favourite piano works:
      </motion.p>
      <ul className="list-disc ml-6 space-y-2 text-gray-800">
        {pieces.map((p) => {
          const selected = audioUrl === p.embed;
          const playing = selected && isPlaying;
          return (
            <li key={p.title} className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (audioUrl === p.embed) {
                    setIsPlaying(!isPlaying);
                  } else {
                    setAudioUrl(p.embed);
                    setIsPlaying(true);
                  }
                }}
                className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={playing ? "Pause recording" : "Play recording"}
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setModalUrl(p.embed)}
                className="text-left text-blue-700 hover:underline focus:outline-none focus:underline"
              >
                {p.title}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-10 text-center">
        <a
          href="/music"
          className="inline-block px-6 py-3 rounded-2xl shadow hover:shadow-md transition bg-blue-600 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          More Music
        </a>
      </div>
      
      {/* Hidden audio player */}
      <ReactPlayer url={audioUrl} playing={isPlaying} width={0} height={0} style={{ display: "none" }} />
      
      {/* Video Modal */}
      {modalUrl && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setModalUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Music performance video"
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
          <button
            onClick={() => setModalUrl(null)}
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
            aria-label="Close video"
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}