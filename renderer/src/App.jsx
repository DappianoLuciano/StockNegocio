import { useState } from "react";
import StockPage from "./pages/StockPage";
import VentasPage from "./pages/VentasPage";

const TEMPORADAS = [
  { id: "invierno26", label: "Invierno '26", emoji: "❄️" },
  { id: "verano26",   label: "Verano '26",   emoji: "☀️" },
];

export default function App() {
  const [season, setSeason]           = useState("invierno26");
  const [switching, setSwitching]     = useState(false);
  const [currentPage, setCurrentPage] = useState("stock");

  async function handleSeasonChange(id) {
    if (switching) return;
    if (id === season) { setCurrentPage("stock"); return; }
    setSwitching(true);
    try {
      await window.api.switchDb({ season: id });
      setSeason(id);
      setCurrentPage("stock");
    } catch (e) {
      alert("No se pudo cambiar de temporada: " + (e?.message || e));
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="appLayout">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="sidebarBrand">KAIA</div>
          <div className="sidebarSub">Stock de negocio</div>
        </div>

        <nav className="sideNav">
          <div className="sideSectionLabel">Temporadas</div>
          {TEMPORADAS.map((t) => (
            <button
              key={t.id}
              className={season === t.id && currentPage === "stock" ? "sideItem active" : "sideItem"}
              onClick={() => handleSeasonChange(t.id)}
              type="button"
              disabled={switching}
            >
              <span className="dot" />
              <span>{t.emoji} {t.label}</span>
            </button>
          ))}

          <div className="sideDivider" />
          <button
            className={currentPage === "ventas" ? "sideItem active" : "sideItem"}
            onClick={() => setCurrentPage("ventas")}
            type="button"
          >
            <span className="dot" />
            <span>🛍️ Ventas</span>
          </button>
        </nav>

        <div className="sidebarFooter">
          <div className="hintSmall">
            Temporada activa:<br />
            <strong>{TEMPORADAS.find((t) => t.id === season)?.label}</strong>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="mainContent">
          <div className="container">
            {switching
              ? <div style={{ padding: 40, color: "var(--muted)", fontWeight: 800 }}>Cambiando temporada...</div>
              : currentPage === "stock"
                ? <StockPage key={season} season={season} />
                : <VentasPage key={season} season={season} />
            }
          </div>
        </div>
      </main>
    </div>
  );
}
