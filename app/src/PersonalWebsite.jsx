import React from "react";
import "./blobEffect.scss"; // blue blobs background
import ErrorBoundary from "./components/ErrorBoundary";
import Header from "./components/Header";
import Hero from "./components/Hero";
import About from "./components/About";
import Projects from "./components/Projects";
import Music from "./components/Music";
import Books from "./components/Books";
import Contact from "./components/Contact";
import ResumeModal from "./components/ResumeModal";

export default function PersonalWebsite() {
  const [resumeOpen, setResumeOpen] = React.useState(false);

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
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <ErrorBoundary>
      <div className="font-sans scroll-smooth">
        <Header />
        <Hero onResumeOpen={() => setResumeOpen(true)} />
        <ResumeModal isOpen={resumeOpen} onClose={() => setResumeOpen(false)} />
        <About />
        <Projects />
        <Music />
        <Books />
        <Contact />
        
        <footer className="py-6 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Frederick Wang
        </footer>
      </div>
    </ErrorBoundary>
  );
}
