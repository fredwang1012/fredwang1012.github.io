import React from "react";
import { Menu, X } from "lucide-react";

const sections = ["about", "projects", "music", "books", "contact"];

export default function Header() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur z-50 shadow-xs">
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        <a href="#home" className="text-xl font-bold tracking-tight">
          Frederick Wang
        </a>
        <ul className="hidden md:flex gap-6 text-sm font-medium">
          {sections.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className="hover:text-blue-600 capitalize">
                {id}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="md:hidden -mr-2 p-2 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>
      {menuOpen && (
        <ul
          id="mobile-menu"
          className="md:hidden bg-white border-t border-gray-100 px-6 py-2 text-base font-medium"
        >
          {sections.map((id) => (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={() => setMenuOpen(false)}
                className="block py-3 capitalize hover:text-blue-600"
              >
                {id}
              </a>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
