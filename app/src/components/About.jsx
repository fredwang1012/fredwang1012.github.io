import React from "react";
import { motion } from "motion/react";

export default function About() {
  return (
    <section id="about" className="max-w-6xl mx-auto px-6 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-bold mb-8"
      >
        About
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-lg leading-relaxed"
      >
        I'm Frederick Wang, an M.Sc. Applied Computing student (AI concentration) at the University of Toronto, after a B.Sc. in Computer Science and Statistics from the University of British Columbia. My current work is on safe autonomous driving with world models and on foundation-model time-series forecasting. Previously, I was a Data Engineer Intern at BCI.<br /><br />
        Outside of work, I play piano, ski, play soccer and badminton, and spend as much time outdoors as I can. I also read a lot, mostly classic literature, philosophy, and fiction.
      </motion.p>
    </section>
  );
}