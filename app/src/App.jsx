import PersonalWebsite from "./PersonalWebsite.jsx";
import MusicPage from "./MusicPage.jsx";
import BooksPage from "./BooksPage.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PersonalWebsite />} />
        <Route path="/music" element={<MusicPage />} />
        <Route path="/books" element={<BooksPage />} />
      </Routes>
    </BrowserRouter>
  );
}
