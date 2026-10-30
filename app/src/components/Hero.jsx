import React, { Suspense, lazy } from "react";
import { motion } from "motion/react";
import { Mail, FileText } from "lucide-react";
import { Github } from "./icons/BrandIcons";
const Interactive3DProfile = lazy(() => import("./three/Interactive3DProfile"));

export default function Hero({ onResumeOpen }) {
  return (
    <section
      id="home"
      className="relative min-h-[85vh] pt-28 pb-16 flex items-center justify-center bg-white overflow-hidden"
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
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
          Frederick Wang
        </h1>
        <p className="text-lg md:text-2xl text-gray-700 max-w-2xl mx-auto">
          M.Sc. Applied Computing (AI) student at UofT, building{" "}
          <span className="font-semibold text-gray-900">machine learning</span>{" "}
          for autonomous driving, forecasting, and healthcare.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onResumeOpen}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-base rounded-lg bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <FileText className="w-4 h-4" />
            Resume
          </button>
          <a
            href="https://github.com/fredwang1012"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-base rounded-lg bg-white/80 border border-gray-200 font-medium shadow-sm hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          <a
            href="mailto:fredwang1012@gmail.com"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-base rounded-lg bg-white/80 border border-gray-200 font-medium shadow-sm hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            <Mail className="w-4 h-4" />
            Email
          </a>
        </div>
      </motion.div>
    </section>
  );
}