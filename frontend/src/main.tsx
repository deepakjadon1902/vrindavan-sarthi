import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyTheme } from "./lib/theme";
import "./index.css";

applyTheme("dark");

createRoot(document.getElementById("root")!).render(<App />);
