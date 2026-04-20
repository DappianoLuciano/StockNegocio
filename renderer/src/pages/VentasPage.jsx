import { useEffect, useMemo, useState } from "react";

const TALLESETS = {
  letras:    ["S","M","L","XL","XXL"],
  numericos: ["40","42","44","46","48","50","52"],
  none:      [],
};
const TIPO_TO_CURVA = {
  REMERA:"letras",SWEATER:"letras",CAMISA:"letras",ABRIGO:"letras",
  CAMPERA:"letras",VESTIDO:"letras",MONOPRENDA:"letras",POLERA:"letras",
  CHALECO:"letras",CONJUNTO:"letras",TRAJE:"letras",
  "PANTALON SASTRERO":"numericos",JEANS:"numericos",JOGGING:"numericos",
  PALAZO:"numericos",FALDA:"numericos",SHORT:"numericos",
  BERMUDAS:"numericos",MALLA:"numericos",
  CHALINA:"none",CINTURÓN:"none",BIJOU:"none",
};

function getTalles(producto) {
  if (!producto) return [];
  const curva = TIPO_TO_CURVA[producto.tipo] || "none";
  return TALLESETS[curva] || [];
}

function parseTalleStock(s) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatMiles(v) {
  const s = String(v ?? "").replace(/\./g, "").replace(/\D/g, "");
  if (!s) return "";
  return Number(s).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtMoney(v) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  return Number.isNaN(n) ? "-" : n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtFecha(s) {
  if (!s) return "-";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function clampInt(v) {
  const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? 1 : Math.max(1, Math.floor(n));
}

// ── Buscador de producto ──────────────────────────────────────────
function ProductoComboField({ value, query, open, resultados, onFocus, onChange, onBlur, onSelect, error }) {
  return (
    <label className="field" style={{ position: "relative" }}>
      <span>Producto *</span>
      <input
        className={error ? "inputError" : ""}
        value={open ? query : value}
        placeholder="Buscar por marca, tipo o código..."
        onFocus={onFocus}
        onChange={onChange}
        onBlur={onBlur}
        autoComplete="off"
      />
      {open && resultados.length > 0 && (
        <div className="comboDropdown">
          {resultados.slice(0, 12).map((p) => {
            const ts = parseTalleStock(p.talleStock);
            const stockTotal = p.stock ?? 0;
            return (
              <button key={p.id} type="button" className="comboItem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(p)}>
                <div style={{ fontWeight: 900 }}>{p.marca} · {p.tipo}{p.codigo ? ` · ${p.codigo}` : ""}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, fontWeight: 700 }}>
                  Stock: {stockTotal} · Precio: {fmtMoney(p.precioFinal)}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {open && resultados.length === 0 && query.trim() && (
        <div className="comboDropdown">
          <div className="comboEmpty">Sin resultados</div>
        </div>
      )}
      <div className="fieldErrorSlot">{error || "\u00A0"}</div>
    </label>
  );
}

// ── Componente principal ──────────────────────────────────────────
export default function VentasPage({ season }) {
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas]       = useState([]);
  const [loading, setLoading]     = useState(false);

  // Form
  const [prodQuery, setProdQuery]     = useState("");
  const [prodOpen, setProdOpen]       = useState(false);
  const [selectedProd, setSelectedProd] = useState(null);
  const [talle, setTalle]             = useState("");
  const [cantidad, setCantidad]       = useState(1);
  const [precioVenta, setPrecioVenta] = useState("");
  const [fecha, setFecha]             = useState(todayStr());
  const [notas, setNotas]             = useState("");
  const [errors, setErrors]           = useState({});

  // Filtros historial — por defecto muestra solo el día de hoy
  const [filterQ, setFilterQ]         = useState("");
  const [filterDesde, setFilterDesde] = useState(todayStr());
  const [filterHasta, setFilterHasta] = useState(todayStr());

  // Modal eliminar
  const [deleteOpen, setDeleteOpen]         = useState(false);
  const [ventaToDelete, setVentaToDelete]   = useState(null);
  const [deleteLoading, setDeleteLoading]   = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  function showToast(msg) {
    setToastMsg(msg);
    window.clearTimeout(window.__toastTimerV);
    window.__toastTimerV = window.setTimeout(() => setToastMsg(""), 2200);
  }

  async function loadProductos() {
    try {
      const data = await window.api.listFrames();
      setProductos(Array.isArray(data) ? data : []);
    } catch { /* silencioso */ }
  }

  async function loadVentas() {
    try {
      setLoading(true);
      const data = await window.api.listVentas();
      setVentas(Array.isArray(data) ? data : []);
    } catch (e) { showToast(e?.message || "Error cargando ventas"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadProductos(); loadVentas(); }, []);

  // Resultado del combo producto
  const resultadosProd = useMemo(() => {
    const term = prodQuery.trim().toLowerCase();
    if (!term) return [];
    return productos.filter((p) =>
      (p.marca || "").toLowerCase().includes(term) ||
      (p.tipo  || "").toLowerCase().includes(term) ||
      String(p.codigo || "").toLowerCase().includes(term)
    );
  }, [prodQuery, productos]);

  // Talles disponibles del producto seleccionado
  const tallesDisponibles = useMemo(() => getTalles(selectedProd), [selectedProd]);

  // Stock disponible para talle seleccionado
  const stockDisponible = useMemo(() => {
    if (!selectedProd) return 0;
    if (talle) {
      const ts = parseTalleStock(selectedProd.talleStock);
      return Math.max(0, Number(ts[talle]) || 0);
    }
    return selectedProd.stock ?? 0;
  }, [selectedProd, talle]);

  function selectProducto(p) {
    setSelectedProd(p);
    setProdQuery("");
    setProdOpen(false);
    setTalle("");
    setPrecioVenta(p.precioFinal != null ? String(Math.round(p.precioFinal)) : "");
    setErrors((prev) => ({ ...prev, producto: "", talle: "" }));
  }

  function clearProducto() {
    setSelectedProd(null);
    setProdQuery("");
    setProdOpen(false);
    setTalle("");
    setPrecioVenta("");
  }

  function handlePrecioChange(e) {
    const raw = e.target.value.replace(/\./g, "").replace(/\D/g, "");
    setPrecioVenta(raw);
    setErrors((prev) => ({ ...prev, precioVenta: "" }));
  }

  function validate() {
    const next = {};
    if (!selectedProd) next.producto = "Seleccioná un producto";
    else if (tallesDisponibles.length > 0 && !talle) next.talle = "Seleccioná un talle";
    if (!precioVenta && precioVenta !== 0) next.precioVenta = "";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    try {
      await window.api.createVenta({
        productoId:  selectedProd.id,
        marca:       selectedProd.marca,
        tipo:        selectedProd.tipo,
        codigo:      selectedProd.codigo || null,
        talle:       talle || null,
        cantidad,
        precioVenta: precioVenta !== "" ? Number(precioVenta) : null,
        fecha,
        notas:       notas.trim() || null,
      });
      // Resetear form
      setSelectedProd(null); setProdQuery(""); setProdOpen(false);
      setTalle(""); setCantidad(1); setPrecioVenta(""); setFecha(todayStr()); setNotas("");
      setErrors({});
      await loadVentas();
      await loadProductos();
      showToast("Venta registrada");
    } catch (err) { showToast(err?.message || "Error registrando venta"); }
  }

  // Filtro + stats del historial
  const ventasFiltradas = useMemo(() => {
    let list = ventas;
    const term = filterQ.trim().toLowerCase();
    if (term) {
      list = list.filter((v) =>
        (v.marca  || "").toLowerCase().includes(term) ||
        (v.tipo   || "").toLowerCase().includes(term) ||
        String(v.codigo || "").toLowerCase().includes(term) ||
        (v.talle  || "").toLowerCase().includes(term)
      );
    }
    if (filterDesde) list = list.filter((v) => v.fecha >= filterDesde);
    if (filterHasta) list = list.filter((v) => v.fecha <= filterHasta);
    return list;
  }, [ventas, filterQ, filterDesde, filterHasta]);

  const totalUnidades = useMemo(() => ventasFiltradas.reduce((s, v) => s + (v.cantidad || 0), 0), [ventasFiltradas]);
  const totalIngresos = useMemo(() => ventasFiltradas.reduce((s, v) => {
    const t = (v.precioVenta || 0) * (v.cantidad || 0);
    return s + t;
  }, 0), [ventasFiltradas]);

  function onDeleteClick(v) { setVentaToDelete(v); setDeleteOpen(true); }

  async function confirmDelete() {
    if (!ventaToDelete) return;
    setDeleteLoading(true);
    try {
      await window.api.deleteVenta({ id: ventaToDelete.id, restoreStock: true });
      setDeleteOpen(false); setVentaToDelete(null);
      await loadVentas();
      await loadProductos();
      showToast("Venta eliminada (stock restaurado)");
    } catch (err) { showToast(err?.message || "Error eliminando venta"); }
    finally { setDeleteLoading(false); }
  }

  const prodDisplayValue = selectedProd
    ? `${selectedProd.marca} · ${selectedProd.tipo}${selectedProd.codigo ? ` · ${selectedProd.codigo}` : ""}`
    : "";

  return (
    <div className="page">
      <h2>Ventas</h2>

      {/* Registrar venta */}
      <section className="card">
        <h3 style={{ margin: "0 0 12px" }}>Registrar venta</h3>
        <form className="form" onSubmit={onSubmit}>
          <div className="grid2">
            {/* Buscador producto */}
            <div style={{ position: "relative" }}>
              {selectedProd ? (
                <div className="field">
                  <span>Producto *</span>
                  <div className="prodSeleccionado">
                    <div className="prodSeleccionadoInfo">
                      <div style={{ fontWeight: 900 }}>{selectedProd.marca} · {selectedProd.tipo}{selectedProd.codigo ? ` · ${selectedProd.codigo}` : ""}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginTop: 2 }}>
                        Precio: {fmtMoney(selectedProd.precioFinal)} · Stock: {selectedProd.stock ?? 0}
                      </div>
                    </div>
                    <button type="button" className="btn" style={{ padding: "6px 12px", width: "auto", fontSize: 12 }}
                      onClick={clearProducto}>Cambiar</button>
                  </div>
                  <div className="fieldErrorSlot">{"\u00A0"}</div>
                </div>
              ) : (
                <ProductoComboField
                  value={prodDisplayValue}
                  query={prodQuery}
                  open={prodOpen}
                  resultados={resultadosProd}
                  error={errors.producto}
                  onFocus={() => { setProdOpen(true); }}
                  onChange={(e) => { setProdQuery(e.target.value); setProdOpen(true); setErrors((p) => ({ ...p, producto: "" })); }}
                  onBlur={() => setTimeout(() => setProdOpen(false), 150)}
                  onSelect={selectProducto}
                />
              )}
            </div>

            {/* Talle */}
            <div className="field">
              <span>Talle</span>
              {tallesDisponibles.length === 0 ? (
                <div style={{ padding: "10px 0", color: "var(--muted)", fontWeight: 800, fontSize: 13 }}>
                  {selectedProd ? "Este tipo no maneja talles." : "Seleccioná un producto primero."}
                </div>
              ) : (
                <div className="tallesVentaGrid">
                  {tallesDisponibles.map((t) => {
                    const ts  = parseTalleStock(selectedProd?.talleStock);
                    const qty = Math.max(0, Number(ts[t]) || 0);
                    return (
                      <button key={t} type="button"
                        className={`talleVentaBtn ${talle === t ? "active" : ""} ${qty === 0 ? "sinStock" : ""}`}
                        onClick={() => { setTalle(t); setErrors((p) => ({ ...p, talle: "" })); }}
                        title={qty === 0 ? "Sin stock" : `Stock: ${qty}`}>
                        <span className="sizeTxt">{t}</span>
                        <span className="talleVentaQty">{qty}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="fieldErrorSlot">{errors.talle || "\u00A0"}</div>
            </div>
          </div>

          <div className="grid2">
            {/* Cantidad */}
            <div className="field">
              <span>Cantidad</span>
              <div className="stepper">
                <button type="button" className="stepBtn"
                  onClick={() => setCantidad((v) => Math.max(1, v - 1))}
                  disabled={cantidad <= 1}>−</button>
                <input value={cantidad}
                  onChange={(e) => setCantidad(clampInt(e.target.value))}
                  inputMode="numeric" style={{ textAlign: "center" }} />
                <button type="button" className="stepBtn"
                  onClick={() => setCantidad((v) => v + 1)}>+</button>
              </div>
              {selectedProd && (talle || tallesDisponibles.length === 0) && (
                <div style={{ fontSize: 12, color: cantidad > stockDisponible ? "var(--danger)" : "var(--muted)", fontWeight: 800, marginTop: 4 }}>
                  Disponible: {stockDisponible}
                  {cantidad > stockDisponible && " — stock insuficiente"}
                </div>
              )}
              <div className="fieldErrorSlot">{"\u00A0"}</div>
            </div>

            {/* Precio venta */}
            <div className="field">
              <span>Precio de venta</span>
              <input
                className={errors.precioVenta ? "inputError" : ""}
                value={formatMiles(precioVenta)}
                onChange={handlePrecioChange}
                inputMode="numeric"
                placeholder="Ej: 35.000"
              />
              <div className="fieldErrorSlot">{errors.precioVenta || "\u00A0"}</div>
            </div>
          </div>

          <div className="grid2">
            {/* Fecha */}
            <label className="field">
              <span>Fecha</span>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <div className="fieldErrorSlot">{"\u00A0"}</div>
            </label>

            {/* Notas */}
            <label className="field">
              <span>Notas (opcional)</span>
              <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: cliente mayorista..." />
              <div className="fieldErrorSlot">{"\u00A0"}</div>
            </label>
          </div>

          <button className="btn primary" type="submit">Registrar venta</button>
        </form>
      </section>

      {/* Historial */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="rowBetween" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Historial de ventas</h3>
          <button className="btn" type="button" onClick={() => { loadVentas(); loadProductos(); }}
            disabled={loading}>{loading ? "Cargando..." : "Refrescar"}</button>
        </div>

        {/* Stats */}
        <div className="ventasStats">
          <div className="ventasStat">
            <div className="ventasStatLabel">Ventas</div>
            <div className="ventasStatValue">{ventasFiltradas.length}</div>
          </div>
          <div className="ventasStat">
            <div className="ventasStatLabel">Unidades</div>
            <div className="ventasStatValue">{totalUnidades}</div>
          </div>
          <div className="ventasStat">
            <div className="ventasStatLabel">Ingresos</div>
            <div className="ventasStatValue">{fmtMoney(totalIngresos)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="ventasFiltros">
          <input style={{ flex: 1, minWidth: 200 }} value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            placeholder="Buscar por marca / tipo / código / talle..." />
          <label className="ventasFiltroFecha">
            <span>Desde</span>
            <input type="date" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)} />
          </label>
          <label className="ventasFiltroFecha">
            <span>Hasta</span>
            <input type="date" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)} />
          </label>
          {(filterQ || filterDesde || filterHasta) && (
            <button type="button" className="btn"
              style={{ padding: "8px 14px", width: "auto", whiteSpace: "nowrap" }}
              onClick={() => { setFilterQ(""); setFilterDesde(""); setFilterHasta(""); }}>
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="table" style={{ marginTop: 12 }}>
          <div className="thead" style={{ gridTemplateColumns: "0.8fr 1fr 1fr 0.6fr 0.5fr 0.5fr 0.7fr 0.7fr 0.9fr 0.7fr" }}>
            <div>Fecha</div>
            <div>Marca</div>
            <div>Tipo</div>
            <div>Código</div>
            <div>Talle</div>
            <div style={{ textAlign: "center" }}>Cant.</div>
            <div style={{ textAlign: "right" }}>Precio</div>
            <div style={{ textAlign: "right" }}>Total</div>
            <div>Notas</div>
            <div style={{ textAlign: "center" }}>Acción</div>
          </div>

          {ventasFiltradas.length === 0
            ? <div className="empty">{loading ? "Cargando..." : "No hay ventas para mostrar."}</div>
            : ventasFiltradas.map((v) => (
              <div key={v.id} className="trow"
                style={{ gridTemplateColumns: "0.8fr 1fr 1fr 0.6fr 0.5fr 0.5fr 0.7fr 0.7fr 0.9fr 0.7fr" }}>
                <div style={{ fontWeight: 800 }}>{fmtFecha(v.fecha)}</div>
                <div style={{ fontWeight: 900 }}>{v.marca}</div>
                <div style={{ fontWeight: 900 }}>{v.tipo}</div>
                <div>{v.codigo || "-"}</div>
                <div>{v.talle || "-"}</div>
                <div style={{ textAlign: "center", fontWeight: 900 }}>{v.cantidad}</div>
                <div className="moneyCell" style={{ textAlign: "right" }}>{fmtMoney(v.precioVenta)}</div>
                <div className="moneyCell" style={{ textAlign: "right", fontWeight: 900, color: "#0b7a55" }}>
                  {v.precioVenta != null ? fmtMoney(v.precioVenta * v.cantidad) : "-"}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.notas || "-"}
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button type="button" className="iconBtn dangerIcon"
                    onClick={() => onDeleteClick(v)} title="Eliminar venta">🗑</button>
                </div>
              </div>
            ))
          }
        </div>
      </section>

      {/* Modal eliminar */}
      {deleteOpen && ventaToDelete && (
        <div className="modalOverlay"
          onMouseDown={() => { if (deleteLoading) return; setDeleteOpen(false); setVentaToDelete(null); }}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Eliminar venta</div>
              <button type="button" className="modalClose"
                onClick={() => { if (deleteLoading) return; setDeleteOpen(false); setVentaToDelete(null); }}>✕</button>
            </div>
            <div style={{ padding: "10px 0 18px 0", fontWeight: 600 }}>
              ¿Eliminar la venta de <b>{ventaToDelete.marca} {ventaToDelete.tipo}</b> del {fmtFecha(ventaToDelete.fecha)}?
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>
                El stock se restaurará automáticamente.
              </div>
            </div>
            <div className="modalActions">
              <button type="button" className="btn"
                onClick={() => { if (deleteLoading) return; setDeleteOpen(false); setVentaToDelete(null); }}>
                Cancelar
              </button>
              <button type="button" className="btn danger" onClick={confirmDelete}
                disabled={deleteLoading} style={{ width: 200 }}>
                {deleteLoading ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
