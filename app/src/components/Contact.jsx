import React from "react";
import { motion } from "framer-motion";
import { Mail, Github, Linkedin, FileText } from "lucide-react";

export default function Contact({ onResumeOpen }) {
  return (
    <section id="contact" className="max-w-6xl mx-auto px-6 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-bold mb-8"
      >
        Get in touch
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-lg mb-8"
      >
        Whether you're interested in collaborating, sharing ideas, or simply chatting about novels, data science, or piano, feel free to reach out. I'd love to connect!
      </motion.p>
      <div className="flex gap-6 justify-center">
        <div className="relative group">
          <a
            href="mailto:fredwang1012@gmail.com"
            className="p-4 rounded-full shadow hover:shadow-md transition bg-blue-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 block"
            aria-label="Email Frederick Wang"
          >
            <Mail className="w-5 h-5" />
          </a>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
            Email
          </span>
        </div>
        <div className="relative group">
          <a
            href="https://github.com/fredwang1012"
            className="p-4 rounded-full shadow hover:shadow-md transition bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-2 block"
            aria-label="GitHub profile"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="w-5 h-5" />
          </a>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
            GitHub
          </span>
        </div>
        <div className="relative group">
          <a
            href="https://www.linkedin.com/in/frederick-wang/"
            className="p-4 rounded-full shadow hover:shadow-md transition bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 block"
            aria-label="LinkedIn profile"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Linkedin className="w-5 h-5" />
          </a>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
            LinkedIn
          </span>
        </div>
        <div className="relative group">
          <button
            onClick={onResumeOpen}
            className="p-4 rounded-full shadow hover:shadow-md transition bg-emerald-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="View resume"
          >
            <FileText className="w-5 h-5" />
          </button>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
            Resume
          </span>
        </div>
      </div>
    </section>
  );
}