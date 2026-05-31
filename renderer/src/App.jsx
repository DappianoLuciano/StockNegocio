import { useState } from "react";
import StockPage from "./pages/StockPage";
import VentasPage from "./pages/VentasPage";
import InstructivoPage from "./pages/InstructivoPage";

const TEMPORADAS = [
  { id: "invierno26", label: "Agregar Invierno '26" },
  { id: "verano26",   label: "Agregar Verano '26" },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState("inventario");
  const [temporada, setTemporada] = useState("invierno26");

  return (
    <div className="appLayout">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="sidebarBrand">KAIA</div>
          <div className="sidebarSub">Stock de negocio</div>
        </div>

        <nav className="sideNav">
          <div className="sideSectionLabel">TEMPORADAS</div>
          {TEMPORADAS.map((t) => (
            <button
              key={t.id}
              className={currentPage === "agregar" && temporada === t.id ? "sideItem active" : "sideItem"}
              onClick={() => {
                setTemporada(t.id);
                setCurrentPage("agregar");
              }}
              type="button"
            >
              <span className="dot" />
              <span>{t.label}</span>
            </button>
          ))}

          <div className="sideDivider" />

          <button
            className={currentPage === "inventario" ? "sideItem active" : "sideItem"}
            onClick={() => setCurrentPage("inventario")}
            type="button"
          >
            <span className="dot" />
            <span>Inventario</span>
          </button>

          <button
            className={currentPage === "ventas" ? "sideItem active" : "sideItem"}
            onClick={() => setCurrentPage("ventas")}
            type="button"
          >
            <span className="dot" />
            <span>Ventas</span>
          </button>

          <button
            className={currentPage === "instructivo" ? "sideItem active" : "sideItem"}
            onClick={() => setCurrentPage("instructivo")}
            type="button"
          >
            <span className="dot" />
            <span>Instructivo</span>
          </button>
        </nav>

        <div className="sidebarFooter">
          <div className="hintSmall">
            KAIA Stock<br />
            <strong>v1.0.3</strong>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="mainContent">
          <div className="container">
            {currentPage === "agregar" ? (
              <StockPage modo="agregar" temporada={temporada} />
            ) : currentPage === "inventario" ? (
              <StockPage modo="inventario" />
            ) : currentPage === "ventas" ? (
              <VentasPage />
            ) : currentPage === "instructivo" ? (
              <InstructivoPage />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
