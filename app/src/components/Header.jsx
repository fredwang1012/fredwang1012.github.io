import React from "react";

export default function Header() {
  return (
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
  );
}