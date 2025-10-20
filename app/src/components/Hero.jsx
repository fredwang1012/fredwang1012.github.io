import React from "react";
import { motion } from "framer-motion";

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
        <img
          src="/frederick.jpg"
          alt="Frederick Wang"
          className="mx-auto mb-6 w-64 h-64 rounded-full object-cover shadow-lg" 
          style={{ objectPosition: "center 0px" }}
        />
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Hi, I'm Frederick <span role="img" aria-label="waving hand">👋</span>
        </h1>
        <p className="text-lg md:text-2xl max-w-2xl mx-auto">
          UBC CS & Stats student building production AI systems and optimization algorithms in retrieval-augmented generation and applied machine learning.
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