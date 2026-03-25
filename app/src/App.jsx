import PersonalWebsite from "./PersonalWebsite.jsx";
import MusicPage from "./MusicPage.jsx";
import BooksPage from "./BooksPage.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PersonalWebsite />} />
        <Route path="/music" element={<MusicPage />} />
        <Route path="/books" element={<BooksPage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
