import React from "react";
import "./blobEffect.scss"; // blue blobs background
import { motion } from "framer-motion";
import { Mail, Github, Linkedin, Play, Pause } from "lucide-react";
import ReactPlayer from "react-player";

/* ---------- Data ---------- */
const projects = [
  {
    title: "GreenLife",
    description:
      "Full-stack web app that personalises Canadian sustainability incentives using AWS Bedrock + RAG (1st place, UBC CIC Generative-AI Sustainability Hackathon).",
    tech: ["Next.js", "AWS Bedrock", "OpenSearch", "S3"],
    link: "https://github.com/fredwang1012/greenlife",
    image: "/greenlife.png",
  },
  {
    title: "WealthComplex",
    description:
      "Mock investment-management platform that lets users trade, manage funds, and research equities.",
    tech: ["Node.js", "React", "Oracle SQL*Plus"],
    link: "https://github.com/fredwang1012/wealthcomplex",
    image: "/wealthcomplex.png",
  },
  {
    title: "Great Expectations – SQL MI Integration",
    description:
      "Contributed SQL Server Managed Instance support to the open-source Great Expectations library and coordinated Databricks integration.",
    tech: ["Python", "Great Expectations", "SQL Server", "Databricks"],
    link: "https://github.com/fredwang1012/great_expectations/tree/fredwang1012",
    image: "/gx.png",
  },
  {
    title: "Query Optimizer++",
    description:
      "Cost-based query optimiser with novel heuristics (in progress).",
    tech: ["Java", "PostgreSQL"],
    link: "https://github.com/fredwang1012/query-optimizer-plus-plus",
  },
];

const experiences = [
  {
    role: "Data & Analytics Intern",
    company: "BCI (British Columbia Investment Management Corporation)",
    period: "May 2025 – Aug 2025",
    bullets: [
      "Extended Great Expectations with SQL Server MI support for Databricks and contributed the enhancement upstream.",
      "Led technical demos that increased platform adoption across multiple teams and improved system reliability.",
      "Won an internal hackathon with a schedule-optimisation algorithm (5 % efficiency gain) and now leading production rollout.",
    ],
  },
  {
    role: "Undergraduate Teaching Assistant",
    company: "University of British Columbia",
    period: "Sep 2024 – Apr 2025",
    bullets: [
      "Delivered lecture material and 1-on-1 support for a large data-science course using R and JupyterLab.",
      "Assisted with grading projects/assignments and proctoring exams for 200+ students.",
    ],
  },
  {
    role: "Data Analyst",
    company: "Providence Research, St. Paul’s Hospital",
    period: "Jan 2024 – Aug 2024",
    bullets: [
      "Cleaned, analysed, and modelled ankle-surgery outcomes in R to surface clinical insights.",
      "Managed multiple project databases to ensure data accuracy and consistency across studies.",
    ],
  },
];

const skills = {
  "Programming Languages": [
    "Python",
    "R",
    "SQL",
    "JavaScript",
    "Java",
    "C++",
    "C",
    "Assembly",
  ],
  "Frameworks & Libraries": [
    "React",
    "Next.js",
    "Node.js",
    "Tailwind",
    "Great Expectations",
  ],
  "Cloud & Web": [
    "AWS (Bedrock, S3, OpenSearch)",
    "Azure",
    "HTML",
    "CSS",
  ],
  "Data & Analytics": [
    "Databricks",
    "Power BI",
    "SQL Server",
    "PostgreSQL",
    "Oracle SQL*Plus",
  ],
};

/* ---------- Component ---------- */
export default function PersonalWebsite() {
  React.useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (hash) {
        const el = document.getElementById(hash.substring(1));
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }
    };
    scrollToHash(); // run on mount
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  // --- Music state & data ---
  const pieces = [
    {
      title: "Rachmaninov – Piano Concerto No. 3 in D minor, Op. 30",
      embed: "https://www.youtube.com/embed/GvKQKnIVy1I?start=30&autoplay=1",
    },
    {
      title: "Rachmaninov – Piano Concerto No. 2 in C minor, Op. 18",
      embed: "https://www.youtube.com/embed/e-x01ddG0x4?start=16&autoplay=1",
    },
    {
      title: "Liszt – Tre sonetti di Petrarca, S. 270 (Sonetto 104)",
      embed: "https://www.youtube.com/embed/qtqmnnZhjfU?start=9&autoplay=1",
    },
  ];
  const [audioUrl, setAudioUrl] = React.useState(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [modalUrl, setModalUrl] = React.useState(null);

  return (
    <div className="font-sans scroll-smooth">
      {/* Navbar */}
      <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur z-50 shadow-sm">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <a href="#home" className="text-xl font-bold tracking-tight">
            Frederick Wang
          </a>
          <ul className="hidden md:flex gap-6 text-sm font-medium">
            {["about", "projects", "music", "books", "contact"].map((id) => (
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
            className="mx-auto mb-6 w-64 h-64 rounded-full object-cover shadow-lg" style={{ objectPosition: "center 0px" }}
          />
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
          I'm Frederick Wang, a fourth-year Computer Science and Statistics student at the University of British Columbia, passionate about building innovative software, optimizing data-driven solutions, and exploring the intersections of finance and technology. I've interned as a Data Analyst at BCI and Providence Research, taught data science as a TA at UBC, and won hackathons focused on optimizing scheduling algorithms and generative AI-driven sustainability solutions.<br /><br />
          Beyond my professional interests, I'm also a dedicated pianist, an avid soccer enthusiast, and someone who deeply enjoys diving into classical literature, philosophy, and thoughtful fiction. I love connecting technical creativity with artistic expression, teamwork, and continuous learning through reading.
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
                  >
                    Details →
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      {/* Music */}
      <section id="music" className="relative max-w-6xl mx-auto px-6 py-24 overflow-hidden">
        
        {/* Music data & modal logic */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold mb-8"
        >
          Music
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-lg leading-relaxed mb-8"
        >
          My personal ranking of favourite piano works:
        </motion.p>
        <ul className="list-disc ml-6 space-y-2 text-gray-800">
          {pieces.map((p) => {
            const selected = audioUrl === p.embed;
            const playing = selected && isPlaying;
            return (
              <li key={p.title} className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (audioUrl === p.embed) {
                      setIsPlaying(!isPlaying);
                    } else {
                      setAudioUrl(p.embed);
                      setIsPlaying(true);
                    }
                  }}
                  className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none"
                  aria-label={playing ? "Pause recording" : "Play recording"}
                >
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                  setModalUrl(p.embed);
                }}
                  className="text-left text-blue-700 hover:underline"
                >
                  {p.title}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-10 text-center">
          <a
            href="/music"
            className="inline-block px-6 py-3 rounded-2xl shadow hover:shadow-md transition bg-blue-600 text-white font-semibold"
          >
            More Music
          </a>
        </div>
        {/* Video Modal */}
        <ReactPlayer url={audioUrl} playing={isPlaying} width={0} height={0} style={{ display: "none" }} />
        {modalUrl && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={() => { setModalUrl(null) }}
          >
            <div
              className="w-full max-w-3xl aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                 
                src={modalUrl}
                title="Music performance"
                className="w-full h-full"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </section>

      {/* Books */}
      <section id="books" className="relative bg-gray-50 py-24 overflow-hidden">
        
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold mb-8"
          >
            Books
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-lg leading-relaxed mb-8"
          >
            A selection of recent reads that left an impression:
          </motion.p>
          <h3 className="text-xl font-semibold mb-2">Currently reading</h3>
          <ul className="list-disc ml-6 space-y-2 text-gray-800">
            <li>“A Day in the Life of Ivan Denisovich” – Aleksandr Solzhenitsyn</li>
          </ul>
          <h3 className="text-xl font-semibold mt-6 mb-2">Favorites</h3>
          <ul className="list-disc ml-6 space-y-2 text-gray-800">
            <li>“The Brothers Karamazov” – Fyodor Dostoevsky</li>
            <li>“The Idiot” – Fyodor Dostoevsky</li>
            <li>“1984” – George Orwell</li>
          </ul>
          <div className="mt-10 text-center">
            <a
              href="/books"
              className="inline-block px-6 py-3 rounded-2xl shadow hover:shadow-md transition bg-blue-600 text-white font-semibold"
            >
              More Books
            </a>
          </div>
        </div>
      </section>

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
          Whether you're interested in collaborating, sharing ideas, or simply chatting about novels, data science, or piano, feel free to reach out. I’d love to connect!
        </motion.p>
        <div className="flex gap-6 justify-center">
          <a
            href="mailto:fredwang1012@gmail.com"
            className="p-4 rounded-full shadow hover:shadow-md transition bg-blue-600 text-white"
            aria-label="Email"
          >
            <Mail className="w-5 h-5" />
          </a>
          <a
            href="https://github.com/fredwang1012"
            className="p-4 rounded-full shadow hover:shadow-md transition bg-gray-800 text-white"
            aria-label="GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
          <a
            href="https://www.linkedin.com/in/frederick-wang/"
            className="p-4 rounded-full shadow hover:shadow-md transition bg-blue-700 text-white"
            aria-label="LinkedIn"
          >
            <Linkedin className="w-5 h-5" />
          </a>
        </div>
      </section>

      <footer className="py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Frederick Wang.
      </footer>
    </div>
  );
}
