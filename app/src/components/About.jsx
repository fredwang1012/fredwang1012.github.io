import React from "react";
import { motion } from "framer-motion";

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
        I'm Frederick Wang, a fourth-year Computer Science and Statistics student at the University of British Columbia, passionate about building innovative software, optimizing data-driven solutions, and exploring the intersections of finance and technology. I've interned as a Data Analyst at BCI and Providence Research, taught data science as a TA at UBC, and won hackathons focused on optimizing scheduling algorithms and generative AI-driven sustainability solutions.<br /><br />
        Beyond my professional interests, I'm also a dedicated pianist, an avid soccer enthusiast, and someone who deeply enjoys diving into classical literature, philosophy, and fiction. I love connecting technical creativity with artistic expression, teamwork, and continuous learning through reading.
      </motion.p>
    </section>
  );
}