import React from "react";

export default function ResumeModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Resume viewer"
    >
      <div
        className="relative w-full max-w-3xl h-[80vh] bg-white rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src="/resume.pdf"
          title="Frederick Wang's Resume"
          className="w-full h-full"
          frameBorder="0"
        />
        <div className="absolute top-4 right-4 flex gap-2">
          <a
            href="/resume.pdf"
            download="Frederick Wang - Resume.pdf"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Download PDF
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-600 text-white shadow hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            aria-label="Close resume viewer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}