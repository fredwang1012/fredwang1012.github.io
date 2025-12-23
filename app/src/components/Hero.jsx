import React from "react";
import { motion } from "framer-motion";
import Interactive3DProfile from "./three/Interactive3DProfile";

export default function Hero({ onResumeOpen }) {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center bg-white overflow-hidden"
    >
      {/* Decorative blue blobs */}
      <div className="blob-field" aria-hidden="true" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center px-6"
      >
        <Interactive3DProfile className="mx-auto mb-6" />
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Hi, I'm Frederick <span role="img" aria-label="waving hand">👋</span>
        </h1>
        <p className="text-lg md:text-2xl max-w-2xl mx-auto">
          UBC CS & Stats student building data-driven products at the intersection
          of <span className="font-semibold">software engineering</span> &{" "}
          <span className="font-semibold">finance</span>.
        </p>
        <div className="mt-8 flex justify-center">
          <button
            onClick={onResumeOpen}
            className="px-5 py-3 rounded-2xl shadow hover:shadow-md transition border border-blue-600 text-blue-600 font-semibold"
          >
            Download Résumé
          </button>
        </div>
      </motion.div>
    </section>
  );
}