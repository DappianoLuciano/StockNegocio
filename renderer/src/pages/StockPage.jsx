// src/pages/StockPage.jsx
import { useEffect, useMemo, useState } from "react";

const DEFAULT_BRANDS = [
  "Garofalo","Ayres","Carla Vianinni","Roxana Mesiano","Anna Rossatti",
  "Essenza","Edel Erra","Mirta Rob","Perramus","Karina Lang",
  "Constanza Hauri","Importadora","Franco Valente","Veramo",
];

const TIPOS = [
  "REMERA","PANTALON SASTRERO","JEANS","POLERA","JOGGING","SWEATER",
  "CAMISA","ABRIGO","CAMPERA","CHALINA","CINTURÓN","BIJOU","PALAZO",
  "VESTIDO","MONOPRENDA","FALDA","SHORT","BERMUDAS","MALLA","CHALECO",
  "CONJUNTO","TRAJE",
];

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

const MULTIPLICADORES = [2.1, 2.2, 2.3, 2.4, 2.5];

function parseTallesCSV(s) {
  return String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}
function getCurvaFromTipo(tipo) {
  const key = TIPO_TO_CURVA[String(tipo || "").trim()] || "none";
  return TALLESETS[key] || [];
}
function parseTalleStock(s) {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}
function calcStockTotal(tsObj) {
  return Object.values(tsObj).reduce((sum, n) => sum + Math.max(0, Math.floor(Number(n) || 0)), 0);
}
function parseColores(s) {
  return String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

// ── MarcaCombo definido FUERA del componente principal ─────────
// Esto es crítico: si se define adentro, React lo desmonta en cada
// render y el input pierde el foco al tipear.
function MarcaComboField({
  label, value, query, open, filtradas, showAdd, newName, error,
  onFocus, onChange, onBlur, onSelect, onNewNameChange, onAddConfirm,
}) {
  return (
    <label className="field" style={{ position: "relative" }}>
      <span>{label}</span>
      <input
        className={error ? "inputError" : ""}
        value={open ? query : value}
        placeholder="Escribí una marca..."
        onFocus={onFocus}
        onChange={onChange}
        onBlur={onBlur}
        autoComplete="off"
      />
      {open && (
        <div className="comboDropdown">
          {filtradas.slice(0, 12).map((b) => (
            <button key={b} type="button" className="comboItem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(b)}>
              <div style={{ fontWeight: 900 }}>{b}</div>
            </button>
          ))}
          {showAdd && (
            <div style={{ padding: "10px 12px", borderTop: filtradas.length > 0 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6, color: "var(--muted)" }}>
                Marca nueva:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={newName}
                  onChange={(e) => onNewNameChange(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="Nombre de la marca"
                  style={{ flex: 1, minHeight: 36 }}
                  autoComplete="off"
                />
                <button type="button" className="btn primary"
                  style={{ width: "auto", padding: "6px 14px" }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onAddConfirm}>
                  Guardar
                </button>
              </div>
            </div>
          )}
          {filtradas.length === 0 && !showAdd && (
            <div className="comboEmpty">Sin resultados</div>
          )}
        </div>
      )}
      <div className="fieldErrorSlot">{error || "\u00A0"}</div>
    </label>
  );
}

// ── TipoCombo definido FUERA del componente principal ──────────
function TipoComboField({ label, value, query, open, filtrados, error,
  onFocus, onChange, onBlur, onSelect, showAdd, newName, onNewNameChange, onAddConfirm }) {
  return (
    <label className="field" style={{ position: "relative" }}>
      <span>{label}</span>
      <input
        className={error ? "inputError" : ""}
        value={open ? query : value}
        placeholder="Elegí o escribí un tipo..."
        onFocus={onFocus}
        onChange={onChange}
        onBlur={onBlur}
        autoComplete="off"
      />
      {open && (
        <div className="comboDropdown">
          {filtrados.slice(0, 24).map((t) => (
            <button key={typeof t === "string" ? t : t.nombre} type="button" className="comboItem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(typeof t === "string" ? t : t.nombre)}>
              <div style={{ fontWeight: 900 }}>{typeof t === "string" ? t : t.nombre}</div>
            </button>
          ))}
          {showAdd && (
            <div style={{ padding: "10px 12px", borderTop: filtrados.length > 0 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6, color: "var(--muted)" }}>
                Tipo nuevo:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newName} onChange={(e) => onNewNameChange(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="Nombre del tipo" style={{ flex: 1, minHeight: 36 }}
                  autoComplete="off" />
                <button type="button" className="btn primary"
                  style={{ width: "auto", padding: "6px 14px" }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onAddConfirm}>
                  Guardar
                </button>
              </div>
            </div>
          )}
          {filtrados.length === 0 && !showAdd && <div className="comboEmpty">Sin resultados</div>}
        </div>
      )}
      <div className="fieldErrorSlot">{error || "\u00A0"}</div>
    </label>
  );
}

// ── Componente principal ───────────────────────────────────────
export default function StockPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems]     = useState([]);
  const [allBrands, setAllBrands] = useState(DEFAULT_BRANDS);
  const [allTipos, setAllTipos]   = useState(TIPOS.map((n) => ({ nombre: n, curva: TIPO_TO_CURVA[n] || "none" })));

  // Modal curva (para tipos nuevos)
  const [curvaModalOpen, setCurvaModalOpen]     = useState(false);
  const [curvaModalNombre, setCurvaModalNombre] = useState("");
  const [curvaModalResolve, setCurvaModalResolve] = useState(null);

  // Crear
  const [marca, setMarca]           = useState("");
  const [tipo, setTipo]             = useState("");
  const [codigo, setCodigo]         = useState("");
  const [costo, setCosto]           = useState("");
  const [precioFinal, setPrecioFinal] = useState("");
  const [talles, setTalles]         = useState([]);
  const [talleStock, setTalleStock] = useState({});
  const [colores, setColores]       = useState([]);
  const [colorInput, setColorInput] = useState("");

  const [marcaQuery, setMarcaQuery]       = useState("");
  const [marcaOpen, setMarcaOpen]         = useState(false);
  const [showAddMarca, setShowAddMarca]   = useState(false);
  const [newMarcaName, setNewMarcaName]   = useState("");

  const [tipoQuery, setTipoQuery]       = useState("");
  const [tipoOpen, setTipoOpen]         = useState(false);
  const [showAddTipo, setShowAddTipo]   = useState(false);
  const [newTipoName, setNewTipoName]   = useState("");

  // Buscar + ordenar
  const [qMarca, setQMarca]   = useState("");
  const [qTipo, setQTipo]     = useState("");
  const [sortKey, setSortKey] = useState("createdAtDesc");

  // Modal editar
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [eMarca, setEMarca]     = useState("");
  const [eTipo, setETipo]       = useState("");
  const [eCodigo, setECodigo]   = useState("");
  const [eCosto, setECosto]     = useState("");
  const [ePrecioFinal, setEPrecioFinal] = useState("");
  const [eTalles, setETalles]   = useState([]);
  const [eTalleStock, setETalleStock] = useState({});
  const [eColores, setEColores] = useState([]);
  const [eColorInput, setEColorInput] = useState("");

  const [eMarcaQuery, setEMarcaQuery]       = useState("");
  const [eMarcaOpen, setEMarcaOpen]         = useState(false);
  const [eShowAddMarca, setEShowAddMarca]   = useState(false);
  const [eNewMarcaName, setENewMarcaName]   = useState("");
  const [eTipoQuery, setETipoQuery]       = useState("");
  const [eTipoOpen, setETipoOpen]         = useState(false);
  const [eShowAddTipo, setEShowAddTipo]   = useState(false);
  const [eNewTipoName, setENewTipoName]   = useState("");

  // Modal stock por talle
  const [talleModalOpen, setTalleModalOpen]   = useState(false);
  const [talleModalRow, setTalleModalRow]     = useState(null);
  const [talleModalTalle, setTalleModalTalle] = useState(null);
  const [talleModalQty, setTalleModalQty]     = useState(0);

  // Modal eliminar
  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [rowToDelete, setRowToDelete]     = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  function showToast(msg) {
    setToastMsg(msg);
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToastMsg(""), 2200);
  }

  const [errors, setErrors] = useState({ marca:"", tipo:"", costo:"", precioFinal:"" });
  function clearErr(k) { setErrors((p) => (p[k] ? { ...p, [k]: "" } : p)); }

  function toNumOrNull(v) {
    const s = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
    if (s === "") return null;
    const n = Number(s);
    return Number.isNaN(n) ? NaN : n;
  }

  function clampInt(v) {
    const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
    return Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n));
  }

  // Formatea con puntos de miles: "25000" -> "25.000"
  function formatMiles(v) {
    const s = String(v ?? "").replace(/\./g, "").replace(/\D/g, "");
    if (!s) return "";
    return Number(s).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  }

  // Al escribir en campo precio: guarda solo dígitos
  function handlePrecioChange(e, setter, errKey) {
    const raw = e.target.value.replace(/\./g, "").replace(/\D/g, "");
    setter(raw);
    if (errKey) clearErr(errKey);
  }

  // Marcas
  async function loadMarcas() {
    try {
      const dbMarcas = await window.api.listMarcas();
      const nombres  = dbMarcas.map((m) => m.nombre);
      const merged   = Array.from(new Set([...DEFAULT_BRANDS, ...nombres])).sort((a, b) => a.localeCompare(b));
      setAllBrands(merged);
    } catch { /* usa defaults */ }
  }

  // Tipos
  async function loadTipos() {
    try {
      const dbTipos = await window.api.listTipos();
      const defaults = TIPOS.map((n) => ({ nombre: n, curva: TIPO_TO_CURVA[n] || "none" }));
      const dbMap = {};
      dbTipos.forEach((t) => { dbMap[t.nombre] = t; });
      const merged = [...defaults];
      dbTipos.forEach((t) => {
        if (!merged.find((x) => x.nombre === t.nombre)) merged.push(t);
      });
      merged.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setAllTipos(merged);
    } catch { /* usa defaults */ }
  }

  // Abre modal para elegir curva y devuelve la curva elegida
  function askCurva(nombre) {
    return new Promise((resolve) => {
      setCurvaModalNombre(nombre);
      setCurvaModalResolve(() => resolve);
      setCurvaModalOpen(true);
    });
  }

  async function handleAddTipo(isEdit) {
    const name = (isEdit ? eNewTipoName : newTipoName).trim();
    if (!name) return;
    const curva = await askCurva(name);
    if (!curva) return; // canceló
    try {
      await window.api.createTipo({ nombre: name, curva });
      await loadTipos();
      if (isEdit) {
        setETipo(name); setETipoQuery(""); setETipoOpen(false);
        setEShowAddTipo(false); setENewTipoName("");
      } else {
        setTipo(name); setTipoQuery(""); setTipoOpen(false);
        setShowAddTipo(false); setNewTipoName("");
      }
      clearErr("tipo");
    } catch (err) { showToast(err?.message || "No se pudo guardar el tipo"); }
  }

  async function saveMarca(nombre, onSuccess) {
    const n = nombre.trim();
    if (!n) return;
    try {
      await window.api.createMarca({ nombre: n });
      await loadMarcas();
      onSuccess(n);
    } catch (err) { showToast(err?.message || "No se pudo guardar la marca"); }
  }

  async function handleAddMarca(isEdit) {
    const name = isEdit ? eNewMarcaName : newMarcaName;
    await saveMarca(name, (saved) => {
      if (isEdit) {
        setEMarca(saved); setEMarcaQuery(""); setEMarcaOpen(false);
        setEShowAddMarca(false); setENewMarcaName("");
      } else {
        setMarca(saved); setMarcaQuery(""); setMarcaOpen(false);
        setShowAddMarca(false); setNewMarcaName("");
      }
      clearErr("marca");
    });
  }

  // Carga
  async function load() {
    try {
      setLoading(true);
      const data = await window.api.listFrames();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) { showToast(e?.message || "Error cargando stock"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); loadMarcas(); loadTipos(); }, []);

  useEffect(() => {
    const avail = getCurvaFromTipo(tipo);
    setTalles((prev) => prev.filter((x) => avail.includes(x)));
    setTalleStock((prev) => {
      const next = {};
      avail.forEach((t) => { if (prev[t] !== undefined) next[t] = prev[t]; });
      return next;
    });
  }, [tipo]);

  useEffect(() => {
    const avail = getCurvaFromTipo(eTipo);
    setETalles((prev) => prev.filter((x) => avail.includes(x)));
    setETalleStock((prev) => {
      const next = {};
      avail.forEach((t) => { if (prev[t] !== undefined) next[t] = prev[t]; });
      return next;
    });
  }, [eTipo]);

  // Combos filtrados
  const marcasFiltradas = useMemo(() => {
    const term = marcaQuery.trim().toLowerCase();
    if (!term) return [];
    return allBrands.filter((b) => b.toLowerCase().startsWith(term));
  }, [marcaQuery, allBrands]);

  const eMarcasFiltradas = useMemo(() => {
    const term = eMarcaQuery.trim().toLowerCase();
    if (!term) return [];
    return allBrands.filter((b) => b.toLowerCase().startsWith(term));
  }, [eMarcaQuery, allBrands]);

  const tiposFiltrados = useMemo(() => {
    const term = tipoQuery.trim().toLowerCase();
    if (!term) return allTipos;
    return allTipos.filter((t) => t.nombre.toLowerCase().startsWith(term));
  }, [tipoQuery, allTipos]);

  const eTiposFiltrados = useMemo(() => {
    const term = eTipoQuery.trim().toLowerCase();
    if (!term) return allTipos;
    return allTipos.filter((t) => t.nombre.toLowerCase().startsWith(term));
  }, [eTipoQuery, allTipos]);

  // Filtro + orden
  const filtered = useMemo(() => {
    const tm = qMarca.trim().toLowerCase();
    const tt = qTipo.trim().toLowerCase();
    return items.filter((f) => {
      if (tm && !(f.marca || "").toLowerCase().includes(tm)) return false;
      if (tt && !((f.tipo || "").toLowerCase().includes(tt) || String(f.codigo || "").toLowerCase().includes(tt))) return false;
      return true;
    });
  }, [qMarca, qTipo, items]);

  function codeAsNum(code) {
    const s = String(code ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cn = (a, b) => (a ?? 0) - (b ?? 0);
    switch (sortKey) {
      case "costoAsc":        arr.sort((a,b)=>cn(a.costo,b.costo)); break;
      case "costoDesc":       arr.sort((a,b)=>cn(b.costo,a.costo)); break;
      case "precioFinalAsc":  arr.sort((a,b)=>cn(a.precioFinal,b.precioFinal)); break;
      case "precioFinalDesc": arr.sort((a,b)=>cn(b.precioFinal,a.precioFinal)); break;
      case "stockAsc":        arr.sort((a,b)=>(a.stock??0)-(b.stock??0)); break;
      case "stockDesc":       arr.sort((a,b)=>(b.stock??0)-(a.stock??0)); break;
      case "codigoAsc":  arr.sort((a,b)=>{const an=codeAsNum(a.codigo),bn=codeAsNum(b.codigo);return an!==null&&bn!==null?an-bn:String(a.codigo??"").localeCompare(String(b.codigo??""));}); break;
      case "codigoDesc": arr.sort((a,b)=>{const an=codeAsNum(a.codigo),bn=codeAsNum(b.codigo);return an!==null&&bn!==null?bn-an:String(b.codigo??"").localeCompare(String(a.codigo??""));}); break;
      default: break;
    }
    return arr;
  }, [filtered, sortKey]);

  // Helpers talles
  function setTalleQty(talle, val, setter) {
    setter((prev) => ({ ...prev, [talle]: clampInt(val) }));
  }

  function toggleTalle(talle, tallesState, setTallesState, tsState, setTsState) {
    if (tallesState.includes(talle)) {
      setTallesState((prev) => prev.filter((x) => x !== talle));
      setTsState((prev) => { const n = { ...prev }; delete n[talle]; return n; });
    } else {
      setTallesState((prev) => [...prev, talle]);
      setTsState((prev) => ({ ...prev, [talle]: 0 }));
    }
  }

  // Helpers colores
  function addColor(col, coloresState, setColoresState, setInput) {
    const c = col.trim();
    if (!c || coloresState.includes(c)) { setInput(""); return; }
    setColoresState((prev) => [...prev, c]);
    setInput("");
  }

  function removeColor(col, setColoresState) {
    setColoresState((prev) => prev.filter((x) => x !== col));
  }

  function handleColorKeyDown(e, coloresState, setColoresState, inputVal, setInput) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addColor(inputVal, coloresState, setColoresState, setInput);
    } else if (e.key === "Backspace" && !inputVal && coloresState.length > 0) {
      setColoresState((prev) => prev.slice(0, -1));
    }
  }

  // Multiplicadores
  function aplicarMult(mult, costoVal, setPF) {
    const c = toNumOrNull(costoVal);
    if (c === null || Number.isNaN(c) || c < 0) return;
    // Guarda como número puro (sin puntos) — formatMiles lo muestra formateado
    setPF(String(Math.round(c * mult)));
    clearErr("precioFinal");
  }

  // Modal talle
  function openTalleModal(row, talle) {
    const ts = parseTalleStock(row.talleStock);
    setTalleModalRow(row);
    setTalleModalTalle(talle);
    setTalleModalQty(ts[talle] ?? 0);
    setTalleModalOpen(true);
  }

  async function saveTalleModal(newQty) {
    if (!talleModalRow || !talleModalTalle) return;
    const ts      = parseTalleStock(talleModalRow.talleStock);
    const current = ts[talleModalTalle] ?? 0;
    const delta   = newQty - current;
    try {
      await window.api.updateFrameStock({ productoId: talleModalRow.id, delta, talle: talleModalTalle });
      await load();
      setTalleModalOpen(false);
      showToast("Stock actualizado");
    } catch (e) { showToast(e?.message || "Error actualizando stock"); }
  }

  // Validaciones
  function validate(m, t, c, pf) {
    const next = { marca:"", tipo:"", costo:"", precioFinal:"" };
    if (!m.trim()) next.marca = "Marca obligatoria";
    if (!t.trim()) next.tipo  = "Tipo de prenda obligatorio";
    const cv = toNumOrNull(c);
    if (cv !== null && Number.isNaN(cv)) next.costo = "Costo inválido";
    else if (cv !== null && cv < 0) next.costo = "El costo no puede ser negativo";
    const pfv = toNumOrNull(pf);
    if (pfv !== null && Number.isNaN(pfv)) next.precioFinal = "Precio final inválido";
    else if (pfv !== null && pfv < 0) next.precioFinal = "El precio final no puede ser negativo";
    setErrors(next);
    return !next.marca && !next.tipo && !next.costo && !next.precioFinal;
  }

  // CRUD
  async function onCreate(e) {
    e.preventDefault();
    if (!validate(marca, tipo, costo, precioFinal)) return;
    try {
      const avail = getCurvaFromTipo(tipo);
      const tallesActivos = avail.length > 0 ? talles : [];
      const tsActivo = {};
      tallesActivos.forEach((t) => { tsActivo[t] = talleStock[t] ?? 0; });

      await window.api.createFrame({
        marca: marca.trim(), tipo: tipo.trim(), codigo: codigo.trim(),
        costo: String(costo).trim(), precioFinal: String(precioFinal).trim(),
        talles: tallesActivos, talleStock: tsActivo, colores,
      });

      setMarca(""); setMarcaQuery(""); setMarcaOpen(false); setShowAddMarca(false); setNewMarcaName("");
      setTipo(""); setTipoQuery(""); setTipoOpen(false);
      setCodigo(""); setCosto(""); setPrecioFinal("");
      setTalles([]); setTalleStock({}); setColores([]); setColorInput("");
      setErrors({ marca:"", tipo:"", costo:"", precioFinal:"" });
      await load();
      showToast("Producto guardado");
    } catch (err) { showToast(err?.message || "Error creando producto"); }
  }

  function openEdit(row) {
    setEditId(row.id);
    setEMarca(row.marca || ""); setEMarcaQuery(""); setEMarcaOpen(false);
    setETipo(row.tipo  || ""); setETipoQuery(""); setETipoOpen(false);
    setECodigo(row.codigo || "");
    setECosto(row.costo == null ? "" : String(row.costo));
    setEPrecioFinal(row.precioFinal == null ? "" : String(row.precioFinal));
    const ts = parseTalleStock(row.talleStock);
    setETalleStock(ts);
    setETalles(Object.keys(ts).length > 0 ? Object.keys(ts) : parseTallesCSV(row.talles));
    setEColores(parseColores(row.colores));
    setEColorInput("");
    setEShowAddMarca(false); setENewMarcaName("");
    setErrors({ marca:"", tipo:"", costo:"", precioFinal:"" });
    setEditOpen(true);
  }

  async function onSaveEdit(e) {
    e.preventDefault();
    if (!editId || !validate(eMarca, eTipo, eCosto, ePrecioFinal)) return;
    try {
      const avail = getCurvaFromTipo(eTipo);
      const tallesActivos = avail.length > 0 ? eTalles : [];
      const tsActivo = {};
      tallesActivos.forEach((t) => { tsActivo[t] = eTalleStock[t] ?? 0; });

      await window.api.updateFrame({
        id: editId, marca: eMarca.trim(), tipo: eTipo.trim(), codigo: eCodigo.trim(),
        costo: String(eCosto).trim(), precioFinal: String(ePrecioFinal).trim(),
        talles: tallesActivos, talleStock: tsActivo, colores: eColores,
      });

      setEditOpen(false); setEditId(null);
      await load();
      showToast("Cambios guardados");
    } catch (err) { showToast(err?.message || "Error guardando cambios"); }
  }

  function onDelete(row) { setRowToDelete(row); setDeleteOpen(true); }

  async function confirmDelete() {
    if (!rowToDelete) return;
    const id = rowToDelete.id;
    setDeleteLoading(true); setDeleteOpen(false); setRowToDelete(null);
    setItems((prev) => prev.filter((x) => x.id !== id));
    showToast("Producto eliminado");
    try { await window.api.deleteFrame({ id }); await load(); }
    catch { showToast("No se pudo eliminar. Se recargó."); await load(); }
    finally { setDeleteLoading(false); }
  }

  function fmtMoney(v) {
    if (v == null || v === "") return "-";
    const n = Number(v);
    return Number.isNaN(n) ? "-" : n.toLocaleString("es-AR", { minimumFractionDigits:0, maximumFractionDigits:2 });
  }

  // getCurva dinámico: primero busca en allTipos (DB), si no usa el map estático
  function getCurva(tipoNombre) {
    const found = allTipos.find((t) => t.nombre === tipoNombre);
    if (found) return TALLESETS[found.curva] || [];
    return getCurvaFromTipo(tipoNombre);
  }

  const tallesDisponiblesCreate = getCurva(tipo);
  const tallesDisponiblesEdit   = getCurva(eTipo);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="page">
      <h2>Stock</h2>

      {/* Crear */}
      <section className="card">
        <div className="rowBetween">
          <h3>Agregar Producto</h3>
          <button className="btn" onClick={load} disabled={loading} type="button">
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>

        <form className="form" onSubmit={onCreate}>
          <div className="grid3">
            <MarcaComboField
              label="Marca *" value={marca} query={marcaQuery} open={marcaOpen}
              filtradas={marcasFiltradas} showAdd={showAddMarca} newName={newMarcaName}
              error={errors.marca}
              onFocus={() => { setMarcaOpen(false); setMarcaQuery(""); setShowAddMarca(false); }}
              onChange={(e) => {
                const v = e.target.value;
                setMarca(v); setMarcaQuery(v);
                const f = allBrands.filter((b) => b.toLowerCase().startsWith(v.toLowerCase().trim()));
                setMarcaOpen(Boolean(v.trim()));
                setShowAddMarca(Boolean(v.trim()) && f.length === 0);
                setNewMarcaName(v);
                clearErr("marca");
              }}
              onBlur={() => setTimeout(() => setMarcaOpen(false), 150)}
              onSelect={(b) => { setMarca(b); setMarcaQuery(""); setMarcaOpen(false); setShowAddMarca(false); clearErr("marca"); }}
              onNewNameChange={setNewMarcaName}
              onAddConfirm={() => handleAddMarca(false)}
            />

            <TipoComboField
              label="Tipo de prenda *" value={tipo} query={tipoQuery} open={tipoOpen}
              filtrados={tiposFiltrados} error={errors.tipo}
              showAdd={showAddTipo} newName={newTipoName}
              onFocus={() => { setTipoOpen(true); setTipoQuery(""); setShowAddTipo(false); }}
              onChange={(e) => {
                const v = e.target.value;
                setTipo(v); setTipoQuery(v); setTipoOpen(true);
                const f = allTipos.filter((t) => t.nombre.toLowerCase().startsWith(v.toLowerCase().trim()));
                setShowAddTipo(Boolean(v.trim()) && f.length === 0);
                setNewTipoName(v);
                clearErr("tipo");
              }}
              onBlur={() => setTimeout(() => setTipoOpen(false), 150)}
              onSelect={(t) => { setTipo(t); setTipoQuery(""); setTipoOpen(false); setShowAddTipo(false); clearErr("tipo"); }}
              onNewNameChange={setNewTipoName}
              onAddConfirm={() => handleAddTipo(false)}
            />

            <label className="field">
              <span>Modelo</span>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              <div className="fieldErrorSlot">{"\u00A0"}</div>
            </label>
          </div>

          <div className="grid2">
            <div className="field">
              <span>Costo</span>
              <input className={errors.costo ? "inputError" : ""} value={formatMiles(costo)}
                onChange={(e) => handlePrecioChange(e, setCosto, "costo")}
                inputMode="numeric" placeholder="Ej: 25.000" />
              <div className="multRow">
                {MULTIPLICADORES.map((m) => (
                  <button key={m} type="button" className="multBtn"
                    onClick={() => aplicarMult(m, costo, setPrecioFinal)}>×{m}</button>
                ))}
              </div>
              <div className="fieldErrorSlot">{errors.costo || "\u00A0"}</div>
            </div>
            <label className="field">
              <span>Precio final</span>
              <input className={errors.precioFinal ? "inputError" : ""} value={formatMiles(precioFinal)}
                onChange={(e) => handlePrecioChange(e, setPrecioFinal, "precioFinal")}
                inputMode="numeric" placeholder="Ej: 35.000" />
              <div className="fieldErrorSlot">{errors.precioFinal || "\u00A0"}</div>
            </label>
          </div>

          {/* Talles */}
          <div className="field">
            <span style={{ fontSize:13, color:"rgba(15,23,42,0.65)", fontWeight:800 }}>Talles y cantidades</span>
            {tallesDisponiblesCreate.length === 0
              ? <div className="hint" style={{ marginTop:6 }}>Este tipo no maneja talles.</div>
              : (
                <div className="talleStockGrid" style={{ marginTop:10 }}>
                  {tallesDisponiblesCreate.map((t) => {
                    const checked = talles.includes(t);
                    return (
                      <div key={t} className={`talleStockPill ${checked ? "active" : ""}`}>
                        <label className="talleCheckLabel">
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleTalle(t, talles, setTalles, talleStock, setTalleStock)} />
                          <span className="sizeTxt">{t}</span>
                        </label>
                        {checked && (
                          <div className="talleQtyStepper">
                            <button type="button" className="stepBtn"
                              onClick={() => setTalleQty(t, (talleStock[t]??0)-1, setTalleStock)}
                              disabled={(talleStock[t]??0) <= 0}>−</button>
                            <input value={talleStock[t]??0}
                              onChange={(e) => setTalleQty(t, e.target.value, setTalleStock)}
                              inputMode="numeric" style={{ textAlign:"center", width:44, minHeight:32 }} />
                            <button type="button" className="stepBtn"
                              onClick={() => setTalleQty(t, (talleStock[t]??0)+1, setTalleStock)}>+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            }
            {talles.length > 0 && (
              <div style={{ marginTop:8, fontSize:13, color:"var(--muted)", fontWeight:800 }}>
                Stock inicial: <span style={{ color:"var(--text)" }}>{calcStockTotal(talleStock)}</span>
              </div>
            )}
            <div className="fieldErrorSlot">{"\u00A0"}</div>
          </div>

          {/* Colores */}
          <div className="field">
            <span style={{ fontSize:13, color:"rgba(15,23,42,0.65)", fontWeight:800 }}>Colores disponibles</span>
            <div className="chipInputBox">
              {colores.map((c) => (
                <span key={c} className="chip">
                  {c}
                  <button type="button" className="chipRemove" onClick={() => removeColor(c, setColores)}>×</button>
                </span>
              ))}
              <input className="chipInput" value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                onKeyDown={(e) => handleColorKeyDown(e, colores, setColores, colorInput, setColorInput)}
                onBlur={() => { if (colorInput.trim()) addColor(colorInput, colores, setColores, setColorInput); }}
                placeholder={colores.length === 0 ? "Escribí y presioná Enter para agregar" : "Agregar color..."} />
            </div>
            <div className="fieldErrorSlot">{"\u00A0"}</div>
          </div>

          <button className="btn primary" type="submit">Guardar producto</button>
        </form>
      </section>

      {/* Inventario */}
      <section className="card" style={{ marginTop:16 }}>
        <div className="rowBetween">
          <h3>Inventario</h3>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <input style={{ width:200 }} value={qMarca} onChange={(e) => setQMarca(e.target.value)}
              placeholder="Marca..." />
            <input style={{ width:200 }} value={qTipo} onChange={(e) => setQTipo(e.target.value)}
              placeholder="Tipo / código..." />
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} style={{ width:260 }}>
              <option value="createdAtDesc">Orden: recientes primero</option>
              <option value="costoAsc">Costo: menor → mayor</option>
              <option value="costoDesc">Costo: mayor → menor</option>
              <option value="precioFinalAsc">Precio final: menor → mayor</option>
              <option value="precioFinalDesc">Precio final: mayor → menor</option>
              <option value="stockAsc">Stock actual: menor → mayor</option>
              <option value="stockDesc">Stock actual: mayor → menor</option>
              <option value="codigoAsc">Código: menor → mayor</option>
              <option value="codigoDesc">Código: mayor → menor</option>
            </select>
          </div>
        </div>

        <div className="table" style={{ marginTop:12 }}>
          <div className="thead" style={{ gridTemplateColumns:"1fr 1fr 0.7fr 0.8fr 0.8fr 1.8fr 1.2fr 0.6fr 0.6fr 1.2fr" }}>
            <div>Marca</div><div>Tipo</div><div>Modelo</div>
            <div>Costo</div><div>P. Final</div><div>Talles</div>
            <div>Colores</div>
            <div style={{ textAlign:"center" }}>S. Inicial</div>
            <div style={{ textAlign:"center" }}>S. Actual</div>
            <div style={{ display:"flex", justifyContent:"center" }}>Acciones</div>
          </div>

          {sorted.length === 0
            ? <div className="empty">No hay productos para mostrar.</div>
            : sorted.map((f) => {
              const avail    = getCurva(f.tipo);
              const selected = parseTallesCSV(f.talles);
              const ts       = parseTalleStock(f.talleStock);
              const fColores = parseColores(f.colores);

              return (
                <div key={f.id} className="trow"
                  style={{ gridTemplateColumns:"1fr 1fr 0.7fr 0.8fr 0.8fr 1.8fr 1.2fr 0.6fr 0.6fr 1.2fr" }}>
                  <div style={{ fontWeight:900 }}>{f.marca}</div>
                  <div style={{ fontWeight:900 }}>{f.tipo}</div>
                  <div>{f.codigo || "-"}</div>
                  <div className="moneyCell">{fmtMoney(f.costo)}</div>
                  <div className="moneyCell">{fmtMoney(f.precioFinal)}</div>

                  {/* Talles — click abre modal */}
                  <div>
                    {avail.length === 0
                      ? <span style={{ color:"var(--muted)", fontWeight:900 }}>-</span>
                      : (
                        <div className="sizeGrid compact">
                          {avail.map((t) => {
                            const checked = selected.includes(t);
                            const qty = ts[t] ?? 0;
                            return (
                              <div key={t}
                                className={`sizePill clickable ${checked ? "pillActive" : ""}`}
                                title={checked ? "Tocar para modificar stock" : "Talle no disponible"}
                                onClick={() => { if (checked) openTalleModal(f, t); }}
                              >
                                <span className="sizeTxt">{t}</span>
                                {checked && <span className="talleBadgeQty">{qty}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )
                    }
                  </div>

                  {/* Colores */}
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {fColores.length === 0
                      ? <span style={{ color:"var(--muted)", fontWeight:900 }}>-</span>
                      : fColores.map((c) => <span key={c} className="chip chipSmall">{c}</span>)
                    }
                  </div>

                  {/* Stock inicial */}
                  <div className="stockCell">
                    <div className="stockBadge stockInicial">{f.stockInicial ?? 0}</div>
                  </div>

                  {/* Stock actual */}
                  <div className="stockCell">
                    <div className={`stockBadge ${(f.stock??0)===0?"stockZero":(f.stock??0)<=2?"stockLow":""}`}>
                      {f.stock ?? 0}
                    </div>
                  </div>

                  <div className="actions">
                    <button type="button" className="btn" onClick={() => openEdit(f)}>Editar</button>
                    <button type="button" className="iconBtn dangerIcon" onClick={() => onDelete(f)} title="Eliminar">🗑</button>
                  </div>
                </div>
              );
            })
          }
        </div>
      </section>

      {/* Modal stock por talle */}
      {talleModalOpen && talleModalRow && (
        <div className="modalOverlay" onMouseDown={() => setTalleModalOpen(false)}>
          <div className="modalCard" style={{ maxWidth:380 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">
                {talleModalRow.marca} {talleModalRow.tipo} · Talle <strong>{talleModalTalle}</strong>
              </div>
              <button type="button" className="modalClose" onClick={() => setTalleModalOpen(false)}>✕</button>
            </div>
            <div style={{ padding:"12px 0" }}>
              <div style={{ fontSize:13, color:"var(--muted)", fontWeight:800, marginBottom:12 }}>
                Cantidad actual: <span style={{ color:"var(--text)", fontSize:20, fontWeight:900 }}>{parseTalleStock(talleModalRow.talleStock)[talleModalTalle] ?? 0}</span>
              </div>
              <div style={{ fontSize:13, color:"var(--muted)", fontWeight:800, marginBottom:8 }}>Nueva cantidad:</div>
              <div className="stepper" style={{ maxWidth:220 }}>
                <button type="button" className="stepBtn"
                  onClick={() => setTalleModalQty((v) => Math.max(0, v-1))}
                  disabled={talleModalQty <= 0}>−</button>
                <input value={talleModalQty}
                  onChange={(e) => setTalleModalQty(clampInt(e.target.value))}
                  inputMode="numeric" style={{ textAlign:"center" }} />
                <button type="button" className="stepBtn"
                  onClick={() => setTalleModalQty((v) => v+1)}>+</button>
              </div>
            </div>
            <div className="modalActions">
              <button type="button" className="btn" onClick={() => setTalleModalOpen(false)}>Cancelar</button>
              <button type="button" className="btn primary" style={{ width:180 }}
                onClick={() => saveTalleModal(talleModalQty)}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editOpen && (
        <div className="modalOverlay" onMouseDown={() => setEditOpen(false)}>
          <div className="modalCard modalLarge" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Editar Producto</div>
              <button type="button" className="modalClose" onClick={() => setEditOpen(false)}>✕</button>
            </div>
            <form className="form" onSubmit={onSaveEdit}>
              <div className="grid2">
                <MarcaComboField
                  label="Marca *" value={eMarca} query={eMarcaQuery} open={eMarcaOpen}
                  filtradas={eMarcasFiltradas} showAdd={eShowAddMarca} newName={eNewMarcaName}
                  error={errors.marca}
                  onFocus={() => { setEMarcaOpen(false); setEMarcaQuery(""); setEShowAddMarca(false); }}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEMarca(v); setEMarcaQuery(v);
                    const f = allBrands.filter((b) => b.toLowerCase().startsWith(v.toLowerCase().trim()));
                    setEMarcaOpen(Boolean(v.trim()));
                    setEShowAddMarca(Boolean(v.trim()) && f.length === 0);
                    setENewMarcaName(v);
                    clearErr("marca");
                  }}
                  onBlur={() => setTimeout(() => setEMarcaOpen(false), 150)}
                  onSelect={(b) => { setEMarca(b); setEMarcaQuery(""); setEMarcaOpen(false); setEShowAddMarca(false); clearErr("marca"); }}
                  onNewNameChange={setENewMarcaName}
                  onAddConfirm={() => handleAddMarca(true)}
                />
                <TipoComboField
                  label="Tipo *" value={eTipo} query={eTipoQuery} open={eTipoOpen}
                  filtrados={eTiposFiltrados} error={errors.tipo}
                  showAdd={eShowAddTipo} newName={eNewTipoName}
                  onFocus={() => { setETipoOpen(true); setETipoQuery(""); setEShowAddTipo(false); }}
                  onChange={(e) => {
                    const v = e.target.value;
                    setETipo(v); setETipoQuery(v); setETipoOpen(true);
                    const f = allTipos.filter((t) => t.nombre.toLowerCase().startsWith(v.toLowerCase().trim()));
                    setEShowAddTipo(Boolean(v.trim()) && f.length === 0);
                    setENewTipoName(v);
                    clearErr("tipo");
                  }}
                  onBlur={() => setTimeout(() => setETipoOpen(false), 150)}
                  onSelect={(t) => { setETipo(t); setETipoQuery(""); setETipoOpen(false); setEShowAddTipo(false); clearErr("tipo"); }}
                  onNewNameChange={setENewTipoName}
                  onAddConfirm={() => handleAddTipo(true)}
                />
              </div>

              <div className="grid2">
                <label className="field">
                  <span>Código</span>
                  <input value={eCodigo} onChange={(e) => setECodigo(e.target.value)} />
                  <div className="fieldErrorSlot">{"\u00A0"}</div>
                </label>
                <div className="field">
                  <span>Costo</span>
                  <input className={errors.costo ? "inputError" : ""} value={formatMiles(eCosto)}
                    onChange={(e) => handlePrecioChange(e, setECosto, "costo")}
                    inputMode="numeric" placeholder="Ej: 25.000" />
                  <div className="multRow">
                    {MULTIPLICADORES.map((m) => (
                      <button key={m} type="button" className="multBtn"
                        onClick={() => aplicarMult(m, eCosto, setEPrecioFinal)}>×{m}</button>
                    ))}
                  </div>
                  <div className="fieldErrorSlot">{errors.costo || "\u00A0"}</div>
                </div>
              </div>

              <div className="grid2">
                <label className="field">
                  <span>Precio final</span>
                  <input className={errors.precioFinal ? "inputError" : ""} value={formatMiles(ePrecioFinal)}
                    onChange={(e) => handlePrecioChange(e, setEPrecioFinal, "precioFinal")}
                    inputMode="numeric" placeholder="Ej: 35.000" />
                  <div className="fieldErrorSlot">{errors.precioFinal || "\u00A0"}</div>
                </label>
                <div />
              </div>

              {/* Talles editar */}
              <div className="field">
                <span style={{ fontSize:13, color:"rgba(15,23,42,0.65)", fontWeight:800 }}>Talles y cantidades</span>
                {tallesDisponiblesEdit.length === 0
                  ? <div className="hint" style={{ marginTop:6 }}>Este tipo no maneja talles.</div>
                  : (
                    <div className="talleStockGrid" style={{ marginTop:10 }}>
                      {tallesDisponiblesEdit.map((t) => {
                        const checked = eTalles.includes(t);
                        return (
                          <div key={t} className={`talleStockPill ${checked ? "active" : ""}`}>
                            <label className="talleCheckLabel">
                              <input type="checkbox" checked={checked}
                                onChange={() => toggleTalle(t, eTalles, setETalles, eTalleStock, setETalleStock)} />
                              <span className="sizeTxt">{t}</span>
                            </label>
                            {checked && (
                              <div className="talleQtyStepper">
                                <button type="button" className="stepBtn"
                                  onClick={() => setTalleQty(t, (eTalleStock[t]??0)-1, setETalleStock)}
                                  disabled={(eTalleStock[t]??0) <= 0}>−</button>
                                <input value={eTalleStock[t]??0}
                                  onChange={(e) => setTalleQty(t, e.target.value, setETalleStock)}
                                  inputMode="numeric" style={{ textAlign:"center", width:44, minHeight:32 }} />
                                <button type="button" className="stepBtn"
                                  onClick={() => setTalleQty(t, (eTalleStock[t]??0)+1, setETalleStock)}>+</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                }
                <div className="fieldErrorSlot">{"\u00A0"}</div>
              </div>

              {/* Colores editar */}
              <div className="field">
                <span style={{ fontSize:13, color:"rgba(15,23,42,0.65)", fontWeight:800 }}>Colores disponibles</span>
                <div className="chipInputBox">
                  {eColores.map((c) => (
                    <span key={c} className="chip">
                      {c}
                      <button type="button" className="chipRemove" onClick={() => removeColor(c, setEColores)}>×</button>
                    </span>
                  ))}
                  <input className="chipInput" value={eColorInput}
                    onChange={(e) => setEColorInput(e.target.value)}
                    onKeyDown={(e) => handleColorKeyDown(e, eColores, setEColores, eColorInput, setEColorInput)}
                    onBlur={() => { if (eColorInput.trim()) addColor(eColorInput, eColores, setEColores, setEColorInput); }}
                    placeholder={eColores.length === 0 ? "Escribí y presioná Enter para agregar" : "Agregar color..."} />
                </div>
                <div className="fieldErrorSlot">{"\u00A0"}</div>
              </div>

              <div className="modalActions">
                <button type="button" className="btn" onClick={() => setEditOpen(false)}>Cancelar</button>
                <button type="submit" className="btn primary" style={{ width:220 }}>Guardar cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {deleteOpen && rowToDelete && (
        <div className="modalOverlay"
          onMouseDown={() => { if (deleteLoading) return; setDeleteOpen(false); setRowToDelete(null); }}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar eliminación</div>
              <button type="button" className="modalClose"
                onClick={() => { if (deleteLoading) return; setDeleteOpen(false); setRowToDelete(null); }}>✕</button>
            </div>
            <div style={{ padding:"10px 0 18px 0", fontWeight:600 }}>
              ¿Querés eliminar <b>{rowToDelete.marca} {rowToDelete.tipo}</b>?
            </div>
            <div className="modalActions">
              <button type="button" className="btn"
                onClick={() => { if (deleteLoading) return; setDeleteOpen(false); setRowToDelete(null); }}>
                Cancelar
              </button>
              <button type="button" className="btn danger" onClick={confirmDelete}
                disabled={deleteLoading} style={{ width:200 }}>
                {deleteLoading ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && <div className="toast">{toastMsg}</div>}

      {/* Modal selección de curva para tipo nuevo */}
      {curvaModalOpen && (
        <div className="modalOverlay">
          <div className="modalCard" style={{ maxWidth: 400 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">¿Qué talles usa "{curvaModalNombre}"?</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 0" }}>
              <button type="button" className="curvaOpcion"
                onClick={() => { setCurvaModalOpen(false); curvaModalResolve("letras"); }}>
                <div className="curvaOpcionTitle">Letras</div>
                <div className="curvaOpcionSub">S · M · L · XL · XXL</div>
              </button>
              <button type="button" className="curvaOpcion"
                onClick={() => { setCurvaModalOpen(false); curvaModalResolve("numericos"); }}>
                <div className="curvaOpcionTitle">Números</div>
                <div className="curvaOpcionSub">40 · 42 · 44 · 46 · 48 · 50 · 52</div>
              </button>
              <button type="button" className="curvaOpcion"
                onClick={() => { setCurvaModalOpen(false); curvaModalResolve("none"); }}>
                <div className="curvaOpcionTitle">Sin talles</div>
                <div className="curvaOpcionSub">Chalina, bijou, cinturón, etc.</div>
              </button>
            </div>
            <div className="modalActions">
              <button type="button" className="btn"
                onClick={() => { setCurvaModalOpen(false); curvaModalResolve(null); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}