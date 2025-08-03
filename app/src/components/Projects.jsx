import React from "react";
import { motion } from "framer-motion";
import { projects } from "../data/projects";

export default function Projects() {
  return (
    <section id="projects" className="bg-gray-50 py-24">
      <div className="max-w-6xl mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold mb-12"
        >
          Projects
        </motion.h2>
        <div className="grid md:grid-cols-2 gap-8">
          {projects.map((proj) => (
            <motion.div
              key={proj.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl shadow-lg bg-white overflow-hidden flex flex-col"
            >
              {proj.image ? (
                <img
                  src={proj.image}
                  alt={proj.title}
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="h-48 w-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                  In&nbsp;Progress
                </div>
              )}
              <div className="p-6 flex flex-col flex-1">
                <h3 className="text-2xl font-semibold mb-2">{proj.title}</h3>
                <p className="flex-1 text-gray-700">{proj.description}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {proj.tech.map((t) => (
                    <span
                      key={t}
                      className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <a
                  href={proj.link}
                  className="mt-6 text-blue-600 font-medium hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Details →
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}