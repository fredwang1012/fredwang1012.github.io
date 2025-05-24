import React from "react";
import { motion } from "framer-motion";
import { Mail, Github, Linkedin } from "lucide-react";

/* ---------- Data ---------- */
const projects = [
  {
    title: "GreenLife",
    description:
      "Full-stack web app that personalises Canadian sustainability incentives using AWS Bedrock + RAG.",
    tech: ["Next.js", "AWS", "Bedrock", "OpenSearch"],
    link: "https://github.com/youruser/greenlife",
    image: "/images/greenlife.png",
  },
  {
    title: "Discuss",
    description:
      "Android app for academic Q&A powered by ChatGPT; won 1st place at nwHacks 2024.",
    tech: ["Android", "Kotlin", "OpenAI"],
    link: "https://github.com/youruser/discuss",
    image: "/images/discuss.png",
  },
  {
    title: "KNN-from-scratch",
    description:
      "Python implementation of k-Nearest Neighbours with custom cross-validation utilities.",
    tech: ["Python", "NumPy"],
    link: "https://github.com/youruser/knn-scratch",
    image: "/images/knn.png",
  },
];

const experiences = [
  {
    role: "Data & Analytics Intern",
    company:
      "BCI (British Columbia Investment Management Corporation)",
    period: "May 2025 – Aug 2025",
    bullets: [
      "Maintained data-quality pipelines in Python + SQL Server for $250 B AUM datasets.",
      "Built Power BI dashboards consumed daily by 40+ investment analysts.",
      "Cut ETL runtimes by 60 % through query optimisation and incremental loading.",
    ],
  },
  {
    role: "Data Analyst Intern",
    company: "Providence Research – Orthopedics",
    period: "Jan 2024 – Apr 2024",
    bullets: [
      "Automated statistical reports in R, reducing manual effort by 10 hrs/week.",
      "Visualised patient-outcome metrics in Power BI to inform surgical decisions.",
    ],
  },
  {
    role: "Teaching Assistant (CPSC 304)",
    company: "University of British Columbia",
    period: "Sep 2024 – Dec 2024",
    bullets: [
      "Led weekly labs on SQL and relational-model theory for 200+ students.",
      "Graded projects and designed exam questions on query optimisation.",
    ],
  },
];

const skills = {
  Languages: ["Python", "R", "Java", "C++", "SQL"],
  "Frameworks & Libraries": ["React", "Next.js", "Tailwind", "scikit-learn"],
  Cloud: ["AWS (Bedrock, Lambda, S3)", "GCP", "Azure DevOps"],
  Data: ["Power BI", "Pandas", "Snowflake", "PostgreSQL"],
};

/* ---------- Component ---------- */
export default function PersonalWebsite() {
  return (
    <div className="font-sans scroll-smooth">
      {/* Navbar */}
      <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur z-50 shadow-sm">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <a href="#home" className="text-xl font-bold tracking-tight">
            Frederick Wang
          </a>
          <ul className="hidden md:flex gap-6 text-sm font-medium">
            {["about", "projects", "experience", "skills", "contact"].map((id) => (
              <li key={id}>
                <a href={`#${id}`} className="hover:text-blue-600 capitalize">
                  {id}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Hero */}
      <section
        id="home"
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center px-6"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Hi, I’m Frederick <span role="img" aria-label="waving hand">👋</span>
          </h1>
          <p className="text-lg md:text-2xl max-w-2xl mx-auto">
            UBC CS & Stats student building data-driven products at the intersection
            of <span className="font-semibold">software engineering</span> &{" "}
            <span className="font-semibold">finance</span>.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <a
              href="#projects"
              className="px-5 py-3 rounded-2xl shadow hover:shadow-md transition bg-blue-600 text-white font-semibold"
            >
              See Projects
            </a>
            <a
              href="/resume.pdf"
              className="px-5 py-3 rounded-2xl shadow hover:shadow-md transition border border-blue-600 text-blue-600 font-semibold"
            >
              Download Résumé
            </a>
          </div>
        </motion.div>
      </section>

      {/* About */}
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
          I’m a 4<sup>th</sup>-year Computer Science & Statistics student at UBC
          graduating May 2026. I thrive in fast-paced teams where I can ship
          features, crunch data and learn new tech on the fly—whether it’s spinning
          up a RAG pipeline on AWS Bedrock during a hackathon or optimising query
          plans for a 250 billion-row dataset. When I’m not coding you’ll find me
          tackling Vancouver’s Grouse Grind or hammering Rachmaninov on the piano.
        </motion.p>
      </section>

      {/* Projects */}
      <section id="projects" className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold mb-12"
          >
            Selected Projects
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
                {proj.image && (
                  <img
                    src={proj.image}
                    alt={proj.title}
                    className="h-48 w-full object-cover"
                  />
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
                  >
                    Details →
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Experience */}
      <section id="experience" className="max-w-6xl mx-auto px-6 py-24">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold mb-12"
        >
          Experience
        </motion.h2>
        <div className="space-y-12">
          {experiences.map((exp) => (
            <motion.div
              key={exp.role + exp.company}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col md:flex-row md:items-start gap-4"
            >
              <div className="min-w-[200px]">
                <p className="font-medium">{exp.role}</p>
                <p className="text-sm text-gray-600">{exp.company}</p>
                <p className="text-sm text-gray-500">{exp.period}</p>
              </div>
              <ul className="list-disc ml-5 space-y-2 text-gray-800">
                {exp.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section id="skills" className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold mb-12"
          >
            Skills
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-8">
            {Object.entries(skills).map(([category, list]) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-6 rounded-2xl shadow bg-white"
              >
                <h3 className="text-xl font-semibold mb-4">{category}</h3>
                <ul className="flex flex-wrap gap-3">
                  {list.map((item) => (
                    <li
                      key={item}
                      className="bg-teal-100 text-teal-800 text-sm px-3 py-1 rounded-full"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
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
          Whether you’re looking to collaborate, hire, or just chat about algorithms
          and Rachmaninov, drop me a line!
        </motion.p>
        <div className="flex gap-6 justify-center">
          <a
            href="mailto:frederick@example.com"
            className="p-4 rounded-full shadow hover:shadow-md transition bg-blue-600 text-white"
            aria-label="Email"
          >
            <Mail className="w-5 h-5" />
          </a>
          <a
            href="https://github.com/frederick"
            className="p-4 rounded-full shadow hover:shadow-md transition bg-gray-800 text-white"
            aria-label="GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
          <a
            href="https://linkedin.com/in/frederick-wang"
            className="p-4 rounded-full shadow hover:shadow-md transition bg-blue-700 text-white"
            aria-label="LinkedIn"
          >
            <Linkedin className="w-5 h-5" />
          </a>
        </div>
      </section>

      <footer className="py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Frederick Wang. Built with React & Tailwind.
      </footer>
    </div>
  );
}
