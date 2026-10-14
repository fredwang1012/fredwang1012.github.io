import React, { Suspense, lazy } from "react";
import { motion } from "motion/react";
const Interactive3DProfile = lazy(() => import("./three/Interactive3DProfile"));

export default function Hero() {
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
        <Suspense
          fallback={
            <img
              src="/frederick.jpg"
              alt="Frederick Wang"
              className="w-64 h-64 rounded-full object-cover mx-auto mb-6"
            />
          }
        >
          <Interactive3DProfile className="mx-auto mb-6" />
        </Suspense>
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Hi, I'm Frederick <span role="img" aria-label="waving hand">👋</span>
        </h1>
        <p className="text-lg md:text-2xl max-w-2xl mx-auto">
          M.Sc. Applied Computing (AI) student at UofT, working on{" "}
          <span className="font-semibold">machine learning</span> &{" "}
          <span className="font-semibold">data engineering</span>.
        </p>
      </motion.div>
    </section>
  );
}