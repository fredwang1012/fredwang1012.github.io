import React from "react";
import { Link } from "react-router-dom";

export default function BooksPage() {
  return (
    <div className="relative min-h-screen px-6 py-24 w-full font-sans">
      <div className="blob-field" aria-hidden="true" />
      <h1 className="text-4xl font-bold mb-4 text-center">Books</h1>
      <p className="text-lg text-center mb-8 italic">Record of my journey through literature.</p>

      <h3 className="text-xl font-semibold mb-2">Currently reading</h3>
      <ul className="list-disc ml-6 space-y-2 text-gray-800 mb-6">
        <li>“A Day in the Life of Ivan Denisovich” – Aleksandr Solzhenitsyn</li>
      </ul>

      <h3 className="text-xl font-semibold mb-2">Favorites</h3>
      <ul className="list-disc ml-6 space-y-2 text-gray-800 mb-6">
        <li>“The Brothers Karamazov” – Fyodor Dostoevsky</li>
        <li>“The Idiot” – Fyodor Dostoevsky</li>
        <li>“1984” – George Orwell</li>
      </ul>

      <h3 className="text-xl font-semibold mb-2">Read</h3>
      <ul className="list-disc ml-6 space-y-2 text-gray-800 mb-6">
        <li>“White Nights” – Fyodor Dostoevsky</li>
        <li>“The Great Gatsby” – F. Scott Fitzgerald</li>
        <li>“Animal Farm” – George Orwell</li>
        <li>“The Emperor of All Maladies” – Siddhartha Mukherjee</li>
        <li>“The Three-Body Problem” – Liu Cixin</li>
        <li>“The Dark Forest” – Liu Cixin</li>
        <li>“Death’s End” – Liu Cixin</li>
        <li>“Kokoro” – Natsume Sōseki</li>
        <li>“The Setting Sun” – Osamu Dazai</li>
        <li>“No Longer Human” – Osamu Dazai</li>
        <li>“Norwegian Wood” – Haruki Murakami</li>
        <li>“Crime and Punishment” – Fyodor Dostoevsky</li>
      </ul>

      <h3 className="text-xl font-semibold mb-2">Favorites</h3>
      <ul className="list-disc ml-6 space-y-2 text-gray-800 mb-6">
        <li>“The Brothers Karamazov” – Fyodor Dostoevsky</li>
        <li>“The Idiot” – Fyodor Dostoevsky</li>
        <li>“1984” – George Orwell</li>
      </ul>

      <h3 className="text-xl font-semibold mb-2">To Read</h3>
      <ul className="list-disc ml-6 space-y-2 text-gray-800 mb-12">
        <li>“Great Expectations” – Charles Dickens</li>
        <li>“Meditations” – Marcus Aurelius</li>
        <li>“Flatland: A Romance of Many Dimensions” – Edwin A. Abbott</li>
        <li>“Faust” – Johann Wolfgang von Goethe</li>
        <li>“Dune” series – Frank Herbert</li>
        <li>“The Iliad” – Homer</li>
        <li>“The Metamorphosis” – Franz Kafka</li>
        <li>“A Song of Ice and Fire” – George R.R. Martin</li>
        <li>“I Am a Cat” – Natsume Sōseki</li>
        <li>“Beyond Good and Evil” – Friedrich Nietzsche</li>
        <li>“The Song of the Cell” – Siddhartha Mukherjee</li>
        <li>“One Hundred Years of Solitude” – Gabriel García Márquez</li>
        <li>“The Republic” – Plato</li>
        <li>“Cancer Ward” – Aleksandr Solzhenitsyn</li>
        <li>“The Gulag Archipelago” – Aleksandr Solzhenitsyn</li>
        <li>“War and Peace” – Leo Tolstoy</li>
        <li>“Lord of the Flies” – William Golding</li>
      </ul>

      

      <div className="text-center">
        <a
          href="/#books"
          className="inline-block px-5 py-3 rounded-2xl shadow hover:shadow-md transition bg-blue-600 text-white font-semibold"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
