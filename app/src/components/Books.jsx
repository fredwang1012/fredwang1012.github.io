import React from "react";
import { motion } from "framer-motion";
import { books } from "../data/books";

export default function Books() {
  return (
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
          {books.currentlyReading.map((book, index) => (
            <li key={index}>"{book.title}" – {book.author}</li>
          ))}
        </ul>
        <h3 className="text-xl font-semibold mt-6 mb-2">Favorites</h3>
        <ul className="list-disc ml-6 space-y-2 text-gray-800">
          {books.favorites.map((book, index) => (
            <li key={index}>"{book.title}" – {book.author}</li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <a
            href="/books"
            className="inline-block px-6 py-3 rounded-2xl shadow hover:shadow-md transition bg-blue-600 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            More Books
          </a>
        </div>
      </div>
    </section>
  );
}