import { useEffect, useMemo, useState } from "react";
import PrintLabel from "../components/PrintLabel";
import ModalEscaneoBarcode from "../components/ModalEscaneoBarcode";

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
  CAMPERA:"letras",VESTIDO:"letras",MONOPRENDRA:"letras",POLERA:"letras",
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

function parseColores(s) {
  return String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

// ── MarcaCombo ──
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
      <div className="fieldErrorSlot">{error || " "}</div>
    </label>
  );
}

// ── TipoCombo ──
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
      <div className="fieldErrorSlot">{error || " "}</div>
    </label>
  );
}

export default function StockPage({ modo = "inventario", temporada = "invierno26" }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [allBrands, setAllBrands] = useState(DEFAULT_BRANDS);
  const [allTipos, setAllTipos] = useState(TIPOS.map((n) => ({ nombre: n, curva: TIPO_TO_CURVA[n] || "none" })));

  // Modal curva
  const [curvaModalOpen, setCurvaModalOpen] = useState(false);
  const [curvaModalNombre, setCurvaModalNombre] = useState("");
  const [curvaModalResolve, setCurvaModalResolve] = useState(null);

  // Crear producto
  const [marca, setMarca] = useState("");
  const [tipo, setTipo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [costo, setCosto] = useState("");
  const [precioFinal, setPrecioFinal] = useState("");
  const [talles, setTalles] = useState([]);
  const [colores, setColores] = useState([]);
  const [colorInput, setColorInput] = useState("");

  const [marcaQuery, setMarcaQuery] = useState("");
  const [marcaOpen, setMarcaOpen] = useState(false);
  const [marcaShowAdd, setMarcaShowAdd] = useState(false);
  const [marcaNewName, setMarcaNewName] = useState("");

  const [tipoQuery, setTipoQuery] = useState("");
  const [tipoOpen, setTipoOpen] = useState(false);
  const [tipoShowAdd, setTipoShowAdd] = useState(false);
  const [tipoNewName, setTipoNewName] = useState("");

  // Producto recién creado
  const [productoCreado, setProductoCreado] = useState(null);

  // Editar producto
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editMarca, setEditMarca] = useState("");
  const [editMarcaQuery, setEditMarcaQuery] = useState("");
  const [editMarcaOpen, setEditMarcaOpen] = useState(false);
  const [editMarcaShowAdd, setEditMarcaShowAdd] = useState(false);
  const [editMarcaNewName, setEditMarcaNewName] = useState("");

  const [editTipo, setEditTipo] = useState("");
  const [editTipoQuery, setEditTipoQuery] = useState("");
  const [editTipoOpen, setEditTipoOpen] = useState(false);
  const [editTipoShowAdd, setEditTipoShowAdd] = useState(false);
  const [editTipoNewName, setEditTipoNewName] = useState("");

  const [editCodigo, setEditCodigo] = useState("");
  const [editCosto, setEditCosto] = useState("");
  const [editPrecioFinal, setEditPrecioFinal] = useState("");
  const [editTalles, setEditTalles] = useState([]);
  const [editColores, setEditColores] = useState([]);
  const [editColorInput, setEditColorInput] = useState("");

  // Modal de códigos de barras
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [barcodeModalProducto, setBarcodeModalProducto] = useState(null);
  const [barcodeModalMode, setBarcodeModalMode] = useState("menu"); // "menu", "escanear", "generar", "success"
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeTalle, setBarcodeTalle] = useState("");
  const [barcodeColor, setBarcodeColor] = useState("");
  const [barcodeCantidad, setBarcodeCantidad] = useState(1);
  const [barcodeErrors, setBarcodeErrors] = useState({});
  const [codigoGenerado, setCodigoGenerado] = useState("");
  const [lastMode, setLastMode] = useState(""); // Para recordar si vino de escanear o generar

  // Búsqueda por código de barras en inventario
  const [searchBarcode, setSearchBarcode] = useState("");
  const [searchBarcodeOpen, setSearchBarcodeOpen] = useState(false);
  const [searchResult, setSearchResult] = useState(null); // Resultado de búsqueda específico
  const [modalEscaneoOpen, setModalEscaneoOpen] = useState(false); // Modal de escaneo

  // Filtros inventario
  const [filterMarca, setFilterMarca] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [sortBy, setSortBy] = useState("createdAtDesc");

  // Modal eliminar producto
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Modal editar código individual
  const [editBarcodeModalOpen, setEditBarcodeModalOpen] = useState(false);
  const [editingBarcode, setEditingBarcode] = useState(null);
  const [editBarcodeCantidad, setEditBarcodeCantidad] = useState(1);

  // Modal eliminar código
  const [deleteBarcodeModalOpen, setDeleteBarcodeModalOpen] = useState(false);
  const [barcodeToDelete, setBarcodeToDelete] = useState(null);

  // Modal incrementar código existente
  const [incrementModalOpen, setIncrementModalOpen] = useState(false);
  const [barcodeToIncrement, setBarcodeToIncrement] = useState(null);
  const [cantidadAIncrementar, setCantidadAIncrementar] = useState(1);

  // Modal impresión
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printProducto, setPrintProducto] = useState(null);

  // Toast
  const [toastMsg, setToastMsg] = useState("");

  function showToast(msg) {
    setToastMsg(msg);
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToastMsg(""), 2200);
  }

  const [errors, setErrors] = useState({ marca: "", tipo: "", costo: "", precioFinal: "" });

  function clearError(field) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));
  }

  // Helper para parsear números
  function parseNum(v) {
    const s = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
    if (s === "") return null;
    const n = Number(s);
    return Number.isNaN(n) ? NaN : n;
  }

  function parseQty(v) {
    const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
    return Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n));
  }

  function formatMiles(v) {
    const s = String(v ?? "").replace(/\./g, "").replace(/\D/g, "");
    if (!s) return "";
    return Number(s).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  }

  function handleNumInput(e, setter, errField) {
    setter(e.target.value.replace(/\./g, "").replace(/\D/g, ""));
    if (errField) clearError(errField);
  }

  // Cargar marcas
  async function loadMarcas() {
    try {
      const dbMarcas = (await window.api.listMarcas()).map((m) => m.nombre);
      setAllBrands(Array.from(new Set([...DEFAULT_BRANDS, ...dbMarcas])).sort((a, b) => a.localeCompare(b)));
    } catch {}
  }

  // Cargar tipos
  async function loadTipos() {
    try {
      const dbTipos = await window.api.listTipos();
      const base = TIPOS.map((n) => ({ nombre: n, curva: TIPO_TO_CURVA[n] || "none" }));
      const merged = [...base];
      dbTipos.forEach((t) => {
        if (!merged.find((x) => x.nombre === t.nombre)) merged.push(t);
      });
      merged.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setAllTipos(merged);
    } catch {}
  }

  // Modal curva
  function askCurva(nombre) {
    return new Promise((resolve) => {
      setCurvaModalNombre(nombre);
      setCurvaModalResolve(() => resolve);
      setCurvaModalOpen(true);
    });
  }

  async function handleAddTipo(isEdit) {
    const name = (isEdit ? editTipoNewName : tipoNewName).trim();
    if (!name) return;
    const curva = await askCurva(name);
    if (!curva) return;
    try {
      await window.api.createTipo({ nombre: name, curva });
      await loadTipos();
      if (isEdit) {
        setEditTipo(name);
        setEditTipoQuery("");
        setEditTipoOpen(false);
        setEditTipoShowAdd(false);
        setEditTipoNewName("");
      } else {
        setTipo(name);
        setTipoQuery("");
        setTipoOpen(false);
        setTipoShowAdd(false);
        setTipoNewName("");
      }
      clearError("tipo");
    } catch (err) {
      showToast(err?.message || "No se pudo guardar el tipo");
    }
  }

  async function handleAddMarca(newName, setter) {
    const name = newName.trim();
    if (!name) return;
    try {
      await window.api.createMarca({ nombre: name });
      await loadMarcas();
      setter(name);
    } catch (err) {
      showToast(err?.message || "No se pudo guardar la marca");
    }
  }

  async function addMarcaCreate() {
    await handleAddMarca(marcaNewName, (n) => {
      setMarca(n);
      setMarcaQuery("");
      setMarcaOpen(false);
      setMarcaShowAdd(false);
      setMarcaNewName("");
      clearError("marca");
    });
  }

  async function addMarcaEdit() {
    await handleAddMarca(editMarcaNewName, (n) => {
      setEditMarca(n);
      setEditMarcaQuery("");
      setEditMarcaOpen(false);
      setEditMarcaShowAdd(false);
      setEditMarcaNewName("");
      clearError("marca");
    });
  }

  async function load() {
    try {
      setLoading(true);
      const data = await window.api.listProductosWithBarcodes();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err?.message || "Error cargando stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadMarcas();
    loadTipos();
  }, []);

  // Filtrar marcas
  const filteredMarcas = useMemo(() => {
    const q = marcaQuery.trim().toLowerCase();
    return q ? allBrands.filter((b) => b.toLowerCase().startsWith(q)) : [];
  }, [marcaQuery, allBrands]);

  const filteredMarcasEdit = useMemo(() => {
    const q = editMarcaQuery.trim().toLowerCase();
    return q ? allBrands.filter((b) => b.toLowerCase().startsWith(q)) : [];
  }, [editMarcaQuery, allBrands]);

  // Filtrar tipos
  const filteredTipos = useMemo(() => {
    const q = tipoQuery.trim().toLowerCase();
    return q ? allTipos.filter((t) => t.nombre.toLowerCase().startsWith(q)) : allTipos;
  }, [tipoQuery, allTipos]);

  const filteredTiposEdit = useMemo(() => {
    const q = editTipoQuery.trim().toLowerCase();
    return q ? allTipos.filter((t) => t.nombre.toLowerCase().startsWith(q)) : allTipos;
  }, [editTipoQuery, allTipos]);

  // Filtrar items
  const filteredItems = useMemo(() => {
    const mq = filterMarca.trim().toLowerCase();
    const tq = filterTipo.trim().toLowerCase();
    return items.filter((item) => {
      if (mq && !(item.marca || "").toLowerCase().includes(mq)) return false;
      if (tq && !((item.tipo || "").toLowerCase().includes(tq) || String(item.codigo || "").toLowerCase().includes(tq))) return false;
      return true;
    });
  }, [filterMarca, filterTipo, items]);

  function parseNumOrNull(v) {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }

  // Ordenar
  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    const cmp = (a, b) => (a ?? 0) - (b ?? 0);

    switch (sortBy) {
      case "costoAsc": arr.sort((a, b) => cmp(a.costo, b.costo)); break;
      case "costoDesc": arr.sort((a, b) => cmp(b.costo, a.costo)); break;
      case "precioFinalAsc": arr.sort((a, b) => cmp(a.precioFinal, b.precioFinal)); break;
      case "precioFinalDesc": arr.sort((a, b) => cmp(b.precioFinal, a.precioFinal)); break;
      case "stockAsc": arr.sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)); break;
      case "stockDesc": arr.sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0)); break;
      case "codigoAsc":
        arr.sort((a, b) => {
          const na = parseNumOrNull(a.codigo);
          const nb = parseNumOrNull(b.codigo);
          if (na !== null && nb !== null) return na - nb;
          return String(a.codigo ?? "").localeCompare(String(b.codigo ?? ""));
        });
        break;
      case "codigoDesc":
        arr.sort((a, b) => {
          const na = parseNumOrNull(a.codigo);
          const nb = parseNumOrNull(b.codigo);
          if (na !== null && nb !== null) return nb - na;
          return String(b.codigo ?? "").localeCompare(String(a.codigo ?? ""));
        });
        break;
      default: break;
    }
    return arr;
  }, [filteredItems, sortBy]);

  function addColor(val, colores, setColores, setInput) {
    const c = val.trim();
    if (!c || colores.includes(c)) {
      setInput("");
      return;
    }
    setColores((prev) => [...prev, c]);
    setInput("");
  }

  function removeColor(c, setColores) {
    setColores((prev) => prev.filter((x) => x !== c));
  }

  function handleColorKey(e, colores, setColores, val, setVal) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addColor(val, colores, setColores, setVal);
    } else if (e.key === "Backspace" && !val && colores.length > 0) {
      setColores((prev) => prev.slice(0, -1));
    }
  }

  function applyMultiplier(mult, costoVal, setPrecio) {
    const c = parseNum(costoVal);
    if (c === null || Number.isNaN(c) || c < 0) return;
    setPrecio(String(Math.round(c * mult)));
    clearError("precioFinal");
  }

  function validate(m, t, cod) {
    const e = { marca: "", tipo: "", codigo: "" };
    if (!m.trim()) e.marca = "Marca obligatoria";
    if (!t.trim()) e.tipo = "Tipo de prenda obligatorio";
    if (!cod.trim()) e.codigo = "Código/Modelo obligatorio";
    setErrors(e);
    return !e.marca && !e.tipo && !e.codigo;
  }

  async function onSubmitCreate(e) {
    e.preventDefault();
    if (!validate(marca, tipo, codigo)) return;

    try {
      const productoNuevo = await window.api.createProducto({
        marca: marca.trim(),
        tipo: tipo.trim(),
        codigo: codigo.trim(),
        costo: costo.trim(),
        precioFinal: precioFinal.trim(),
        talles: talles.join(","),
        colores: colores.join(","),
      });

      setProductoCreado(productoNuevo);
      showToast("Producto creado. Ahora agregá códigos de barras.");

      // NO limpiamos el formulario, solo mostramos el botón "Agregar Stock"
    } catch (err) {
      showToast(err?.message || "Error creando producto");
    }
  }

  function resetFormularioCrear() {
    setMarca("");
    setMarcaQuery("");
    setMarcaOpen(false);
    setMarcaShowAdd(false);
    setMarcaNewName("");

    setTipo("");
    setTipoQuery("");
    setTipoOpen(false);

    setCodigo("");
    setCosto("");
    setPrecioFinal("");
    setTalles([]);
    setColores([]);
    setColorInput("");
    setErrors({ marca: "", tipo: "", codigo: "" });
    setProductoCreado(null);
  }

  function openBarcodeModal(producto) {
    setBarcodeModalProducto(producto);
    setBarcodeModalMode("escanear"); // Abrir directamente en modo escanear
    setBarcodeInput("");
    setBarcodeTalle("");
    setBarcodeColor("");
    setBarcodeCantidad(1);
    setBarcodeErrors({});
    setCodigoGenerado("");
    setBarcodeModalOpen(true);
  }

  function closeBarcodeModal() {
    setBarcodeModalOpen(false);
    setBarcodeModalProducto(null);
    setBarcodeModalMode("menu");
    setLastMode("");
  }

  async function handleEscanearCodigo() {
    const producto = barcodeModalProducto;
    if (!producto) return;

    const tallesDisp = parseTallesCSV(producto.talles);
    const coloresDisp = parseColores(producto.colores);

    const errors = {};
    if (!barcodeInput.trim()) errors.barcode = "Ingresá un código";
    if (tallesDisp.length > 0 && !barcodeTalle) errors.talle = "Seleccioná un talle";
    if (coloresDisp.length > 0 && !barcodeColor) errors.color = "Seleccioná un color";

    setBarcodeErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      // Verificar si el código ya existe
      const existing = await window.api.getBarcodeByCode({ barcode: barcodeInput.trim() });

      if (existing) {
        // Si el código pertenece a OTRO producto → RECHAZAR
        if (existing.producto.id !== producto.id) {
          const productoExistente = `${existing.producto.marca} ${existing.producto.tipo}`;
          showToast(`❌ Este código ya pertenece a otro producto: ${productoExistente}`);
          return;
        }

        // Si el código pertenece a ESTE producto:
        // Verificar si es la misma combinación de talle + color
        const mismaCombinacion =
          existing.talle === (barcodeTalle || null) &&
          existing.color === (barcodeColor || null);

        if (mismaCombinacion) {
          // Misma combinación → ABRIR MODAL para incrementar
          setBarcodeToIncrement(existing);
          setCantidadAIncrementar(1);
          setIncrementModalOpen(true);
          return;
        }
        // Si es diferente combinación → Continuar y crear nuevo registro
      }

      // Crear nuevo registro (código nuevo o código existente con diferente talle/color)
      await window.api.addOrIncrementBarcode({
        productoId: producto.id,
        barcode: barcodeInput.trim(),
        talle: barcodeTalle || null,
        color: barcodeColor || null,
        cantidad: barcodeCantidad,
      });

      showToast(`✓ Código agregado correctamente`);
      setCodigoGenerado(barcodeInput.trim());

      // Resetear campos
      setBarcodeInput("");
      setBarcodeTalle("");
      setBarcodeColor("");
      setBarcodeCantidad(1);
      setBarcodeErrors({});

      await load();

      // Guardar de dónde vino y cambiar a modo success
      setLastMode("escanear");
      setBarcodeModalMode("success");
    } catch (err) {
      showToast(err?.message || "Error agregando código");
    }
  }

  // Confirmar incremento de código existente
  async function confirmarIncrementoCodigo() {
    if (!barcodeToIncrement) return;

    try {
      const nuevaCantidad = barcodeToIncrement.cantidad + cantidadAIncrementar;
      await window.api.updateBarcodeCantidad({
        id: barcodeToIncrement.id,
        cantidad: nuevaCantidad,
      });

      showToast(`✓ Stock incrementado. Anterior: ${barcodeToIncrement.cantidad} → Nuevo: ${nuevaCantidad}`);
      setCodigoGenerado(barcodeToIncrement.barcode);

      // Resetear campos
      setBarcodeInput("");
      setBarcodeTalle("");
      setBarcodeColor("");
      setBarcodeCantidad(1);
      setBarcodeErrors({});

      // Cerrar modal de incremento
      setIncrementModalOpen(false);
      setBarcodeToIncrement(null);
      setCantidadAIncrementar(1);

      await load();

      // Cambiar a modo success
      setLastMode("escanear");
      setBarcodeModalMode("success");
    } catch (err) {
      showToast(err?.message || "Error incrementando stock");
    }
  }

  async function handleGenerarCodigo() {
    const producto = barcodeModalProducto;
    if (!producto) return;

    const tallesDisp = parseTallesCSV(producto.talles);
    const coloresDisp = parseColores(producto.colores);

    const errors = {};
    if (tallesDisp.length > 0 && !barcodeTalle) errors.talle = "Seleccioná un talle";
    if (coloresDisp.length > 0 && !barcodeColor) errors.color = "Seleccioná un color";

    setBarcodeErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      // Generar código automático (sin pasar barcode)
      const result = await window.api.addOrIncrementBarcode({
        productoId: producto.id,
        barcode: "", // Vacío para auto-generar
        talle: barcodeTalle || null,
        color: barcodeColor || null,
        cantidad: barcodeCantidad,
      });

      setCodigoGenerado(result.barcode);

      // Resetear campos
      setBarcodeTalle("");
      setBarcodeColor("");
      setBarcodeCantidad(1);
      setBarcodeErrors({});

      await load();

      // Guardar de dónde vino y cambiar a modo success
      setLastMode("generar");
      setBarcodeModalMode("success");
    } catch (err) {
      showToast(err?.message || "Error generando código");
    }
  }

  function handleAgregarOtroCodigo() {
    // Volver al mismo modo anterior (escanear o generar)
    setCodigoGenerado("");
    setBarcodeModalMode(lastMode);
  }

  function handleVolverAlMenu() {
    setCodigoGenerado("");
    setLastMode("");
    setBarcodeModalMode("menu");
  }

  function handleListo() {
    closeBarcodeModal();
    resetFormularioCrear();
    load();
  }

  function openEdit(row) {
    setEditId(row.id);
    setEditMarca(row.marca || "");
    setEditMarcaQuery("");
    setEditMarcaOpen(false);

    setEditTipo(row.tipo || "");
    setEditTipoQuery("");
    setEditTipoOpen(false);

    setEditCodigo(row.codigo || "");
    setEditCosto(row.costo == null ? "" : String(row.costo));
    setEditPrecioFinal(row.precioFinal == null ? "" : String(row.precioFinal));

    setEditTalles(parseTallesCSV(row.talles));
    setEditColores(parseColores(row.colores));
    setEditColorInput("");

    setEditMarcaShowAdd(false);
    setEditMarcaNewName("");
    setErrors({ marca: "", tipo: "", codigo: "" });

    setEditing(true);
  }

  async function onSubmitEdit(e) {
    e.preventDefault();
    if (!editId || !validate(editMarca, editTipo, editCodigo)) return;

    try {
      await window.api.updateProducto({
        id: editId,
        marca: editMarca.trim(),
        tipo: editTipo.trim(),
        codigo: editCodigo.trim(),
        costo: editCosto.trim(),
        precioFinal: editPrecioFinal.trim(),
        talles: editTalles.join(","),
        colores: editColores.join(","),
      });

      setEditing(false);
      setEditId(null);
      await load();
      showToast("Cambios guardados");
    } catch (err) {
      showToast(err?.message || "Error guardando cambios");
    }
  }

  function openDeleteModal(row) {
    setItemToDelete(row);
    setDeleteModalOpen(true);
  }

  function openPrintModal(row) {
    setPrintProducto(row);
    setPrintModalOpen(true);
  }

  async function confirmDelete() {
    if (!itemToDelete) return;
    const id = itemToDelete.id;
    setDeleting(true);
    setDeleteModalOpen(false);
    setItemToDelete(null);
    setItems((prev) => prev.filter((x) => x.id !== id));
    showToast("Producto eliminado");

    try {
      await window.api.deleteProducto({ id });
      await load();
    } catch {
      showToast("No se pudo eliminar. Se recargó.");
      await load();
    } finally {
      setDeleting(false);
    }
  }

  function openEditBarcodeModal(barcode) {
    setEditingBarcode(barcode);
    setEditBarcodeCantidad(barcode.cantidad);
    setEditBarcodeModalOpen(true);
  }

  async function handleSaveEditBarcode() {
    if (!editingBarcode) return;
    try {
      await window.api.updateBarcodeCantidad({
        id: editingBarcode.id,
        cantidad: editBarcodeCantidad,
      });
      showToast("Cantidad actualizada");
      setEditBarcodeModalOpen(false);
      setEditingBarcode(null);
      await load();
    } catch (err) {
      showToast(err?.message || "Error actualizando cantidad");
    }
  }

  function openDeleteBarcodeModal(barcode) {
    setBarcodeToDelete(barcode);
    setDeleteBarcodeModalOpen(true);
  }

  async function confirmDeleteBarcode() {
    if (!barcodeToDelete) return;
    try {
      await window.api.deleteBarcode({ id: barcodeToDelete.id });
      showToast("Código eliminado");
      setDeleteBarcodeModalOpen(false);
      setBarcodeToDelete(null);
      await load();
    } catch (err) {
      showToast(err?.message || "Error eliminando código");
    }
  }

  async function handleSearchBarcodeFromModal(codigo) {
    try {
      const result = await window.api.getBarcodeByCode({ barcode: codigo });
      if (result) {
        // Guardar el resultado de búsqueda para mostrarlo destacado
        setSearchResult({
          barcode: result,
          producto: result.producto
        });
        setSearchBarcode(codigo);
        showToast(`✓ Encontrado: ${result.producto.marca} ${result.producto.tipo}`);
        setModalEscaneoOpen(false); // Cerrar modal automáticamente
      } else {
        showToast("❌ Código no encontrado");
        throw new Error("Código no encontrado"); // Para que el modal no se cierre
      }
    } catch (err) {
      throw err; // Propagar error para que el modal lo maneje
    }
  }

  async function handleSearchBarcode() {
    const codigo = searchBarcode.trim();
    if (!codigo) {
      setSearchResult(null);
      load();
      return;
    }

    try {
      const result = await window.api.getBarcodeByCode({ barcode: codigo });
      if (result) {
        setSearchResult({
          barcode: result,
          producto: result.producto
        });
        showToast(`✓ Encontrado: ${result.producto.marca} ${result.producto.tipo}`);
      } else {
        setSearchResult(null);
        showToast("Código no encontrado");
      }
      setSearchBarcodeOpen(false);
    } catch (err) {
      setSearchResult(null);
      showToast(err?.message || "Error buscando código");
    }
  }

  function fmtMoney(v) {
    if (v == null || v === "") return "-";
    const n = Number(v);
    return Number.isNaN(n) ? "-" : n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function getCurvaForTipo(tipoNombre) {
    const obj = allTipos.find((t) => t.nombre === tipoNombre);
    return obj ? (TALLESETS[obj.curva] || []) : getCurvaFromTipo(tipoNombre);
  }

  const tallesCrear = ["ÚNICO", ...getCurvaForTipo(tipo)];
  const tituloTemporada = temporada === "invierno26" ? "Invierno '26" : "Verano '26";

  return (
    <div className="page">
      <h2>{modo === "agregar" ? `Agregar Productos - ${tituloTemporada}` : "Inventario"}</h2>

      {/* CREAR - Solo en modo agregar */}
      {modo === "agregar" && (
      <section className="card">
        <div className="rowBetween">
          <h3>Agregar Producto</h3>
          <button className="btn" onClick={load} disabled={loading} type="button">
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>

        <form className="form" onSubmit={onSubmitCreate}>
          <div className="grid3">
            <MarcaComboField
              label="Marca *"
              value={marca}
              query={marcaQuery}
              open={marcaOpen}
              filtradas={filteredMarcas}
              showAdd={marcaShowAdd}
              newName={marcaNewName}
              error={errors.marca}
              onFocus={() => {
                setMarcaOpen(false);
                setMarcaQuery("");
                setMarcaShowAdd(false);
              }}
              onChange={(e) => {
                const val = e.target.value;
                setMarca(val);
                setMarcaQuery(val);
                const filtered = allBrands.filter((b) => b.toLowerCase().startsWith(val.toLowerCase().trim()));
                setMarcaOpen(!!val.trim());
                setMarcaShowAdd(!!val.trim() && filtered.length === 0);
                setMarcaNewName(val);
                clearError("marca");
              }}
              onBlur={() => setTimeout(() => setMarcaOpen(false), 150)}
              onSelect={(b) => {
                setMarca(b);
                setMarcaQuery("");
                setMarcaOpen(false);
                setMarcaShowAdd(false);
                clearError("marca");
              }}
              onNewNameChange={setMarcaNewName}
              onAddConfirm={addMarcaCreate}
            />

            <TipoComboField
              label="Tipo de prenda *"
              value={tipo}
              query={tipoQuery}
              open={tipoOpen}
              filtrados={filteredTipos}
              error={errors.tipo}
              showAdd={tipoShowAdd}
              newName={tipoNewName}
              onFocus={() => {
                setTipoOpen(true);
                setTipoQuery("");
                setTipoShowAdd(false);
              }}
              onChange={(e) => {
                const val = e.target.value;
                setTipo(val);
                setTipoQuery(val);
                setTipoOpen(true);
                const filtered = allTipos.filter((t) => t.nombre.toLowerCase().startsWith(val.toLowerCase().trim()));
                setTipoShowAdd(!!val.trim() && filtered.length === 0);
                setTipoNewName(val);
                clearError("tipo");
              }}
              onBlur={() => setTimeout(() => setTipoOpen(false), 150)}
              onSelect={(t) => {
                setTipo(t);
                setTipoQuery("");
                setTipoOpen(false);
                setTipoShowAdd(false);
                clearError("tipo");
              }}
              onNewNameChange={setTipoNewName}
              onAddConfirm={() => handleAddTipo(false)}
            />

            <label className="field">
              <span>Modelo *</span>
              <input
                className={errors.codigo ? "inputError" : ""}
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value);
                  clearError("codigo");
                }}
              />
              <div className="fieldErrorSlot">{errors.codigo || " "}</div>
            </label>
          </div>

          <div className="grid2">
            <label className="field">
              <span>Costo</span>
              <input
                value={formatMiles(costo)}
                onChange={(e) => handleNumInput(e, setCosto)}
                inputMode="numeric"
                placeholder="Ej: 25.000"
              />
              <div className="fieldErrorSlot">{" "}</div>
            </label>

            <label className="field">
              <span>Precio final</span>
              <input
                value={formatMiles(precioFinal)}
                onChange={(e) => handleNumInput(e, setPrecioFinal)}
                inputMode="numeric"
                placeholder="Ej: 35.000"
              />
              <div className="fieldErrorSlot">{" "}</div>
            </label>
          </div>

          <div className="multRow">
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-medium)", marginRight: 8 }}>
              Multiplicadores:
            </span>
            {MULTIPLICADORES.map((m) => (
              <button key={m} type="button" className="multBtn" onClick={() => applyMultiplier(m, costo, setPrecioFinal)}>
                ×{m}
              </button>
            ))}
          </div>

          {tipo && (
            <div className="field">
              <span style={{ fontSize: 13, color: "rgba(15,23,42,0.65)", fontWeight: 800 }}>Talles disponibles</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {tallesCrear.map((t) => {
                  const active = talles.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`tallePill ${active ? "tallePillActive" : ""}`}
                      onClick={() => {
                        if (active) {
                          setTalles((prev) => prev.filter((x) => x !== t));
                        } else {
                          setTalles((prev) => [...prev, t]);
                        }
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="fieldErrorSlot">{" "}</div>
            </div>
          )}

          <div className="field">
            <span style={{ fontSize: 13, color: "rgba(15,23,42,0.65)", fontWeight: 800 }}>Colores disponibles</span>
            <div className="chipInputBox">
              {colores.map((c) => (
                <span key={c} className="chip">
                  {c}
                  <button type="button" className="chipRemove" onClick={() => removeColor(c, setColores)}>
                    ×
                  </button>
                </span>
              ))}
              <input
                className="chipInput"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                onKeyDown={(e) => handleColorKey(e, colores, setColores, colorInput, setColorInput)}
                onBlur={() => {
                  if (colorInput.trim()) addColor(colorInput, colores, setColores, setColorInput);
                }}
                placeholder={colores.length === 0 ? "Escribí y presioná Enter para agregar" : "Agregar color..."}
              />
            </div>
            <div className="fieldErrorSlot">{" "}</div>
          </div>

          {!productoCreado && (
            <button className="btn primary" type="submit">
              Agregar Stock
            </button>
          )}
        </form>

        {/* Botón "Agregar Stock" después de crear producto */}
        {productoCreado && (
          <div style={{ marginTop: 20, padding: 20, background: "var(--green-soft)", borderRadius: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>
              Producto creado: {productoCreado.marca} {productoCreado.tipo}
            </div>
            <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
              Ahora agregá códigos de barras al producto
            </div>
            <button
              className="btn primary"
              type="button"
              onClick={() => openBarcodeModal(productoCreado)}
              style={{ marginRight: 10 }}
            >
              Agregar Códigos de Barras
            </button>
            <button
              className="btn"
              type="button"
              onClick={resetFormularioCrear}
            >
              Crear Otro Producto
            </button>
          </div>
        )}
      </section>
      )}

      {/* INVENTARIO - Solo en modo inventario */}
      {modo === "inventario" && (
      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Inventario</h3>

          {/* Filtros en grid compacto */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            alignItems: "start"
          }}>
            {/* Búsqueda por código - Botón para abrir modal */}
            <button
              className="btn primary"
              onClick={() => setModalEscaneoOpen(true)}
              style={{ width: "100%", fontSize: 14 }}
            >
              📷 Escanear Código
            </button>

            <input
              value={filterMarca}
              onChange={(e) => setFilterMarca(e.target.value)}
              placeholder="Marca..."
              style={{ width: "100%" }}
            />

            <input
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              placeholder="Tipo / código..."
              style={{ width: "100%" }}
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="createdAtDesc">Recientes primero</option>
              <option value="costoAsc">Costo ↑</option>
              <option value="costoDesc">Costo ↓</option>
              <option value="precioFinalAsc">Precio ↑</option>
              <option value="precioFinalDesc">Precio ↓</option>
              <option value="stockAsc">Stock ↑</option>
              <option value="stockDesc">Stock ↓</option>
              <option value="codigoAsc">Código ↑</option>
              <option value="codigoDesc">Código ↓</option>
            </select>

            <button
              className="btn"
              onClick={() => {
                setSearchBarcode("");
                setFilterMarca("");
                setFilterTipo("");
                setSearchResult(null);
                load();
              }}
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading ? "..." : "Limpiar"}
            </button>
          </div>
        </div>

        {/* RESULTADO DE BÚSQUEDA DESTACADO */}
        {searchResult && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              padding: "12px 16px",
              background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.12) 100%)",
              border: "2px solid var(--teal-300)",
              borderRadius: 12,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--teal-800)" }}>
                Resultado de búsqueda: {searchResult.barcode.barcode}
              </div>
              <button
                className="btn"
                onClick={() => {
                  setSearchBarcode("");
                  setSearchResult(null);
                }}
                style={{ fontSize: 13, padding: "6px 12px" }}
              >
                Cerrar
              </button>
            </div>

            <div style={{
              border: "3px solid var(--teal-400)",
              borderRadius: 12,
              overflow: "hidden",
              background: "white",
              boxShadow: "0 8px 24px rgba(13,158,126,0.2)"
            }}>
              {/* Header */}
              <div style={{ padding: "14px 18px", borderBottom: "2px solid var(--teal-200)", background: "var(--teal-50)" }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: "var(--text)" }}>
                  {searchResult.producto.marca} - {searchResult.producto.tipo} - {searchResult.producto.codigo || "S/C"}
                </h3>
              </div>

              {/* Badges COSTO y PRECIO */}
              <div style={{
                padding: "16px 18px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                background: "var(--bg)"
              }}>
                <div style={{
                  padding: "14px 18px",
                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                  border: "2px solid #fbbf24",
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#92400e", letterSpacing: "0.05em" }}>
                    COSTO
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#78350f" }}>
                    ${fmtMoney(searchResult.producto.costo)}
                  </div>
                </div>

                <div style={{
                  padding: "14px 18px",
                  background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
                  border: "2px solid #34d399",
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#065f46", letterSpacing: "0.05em" }}>
                    PRECIO FINAL
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#064e3b" }}>
                    ${fmtMoney(searchResult.producto.precioFinal)}
                  </div>
                </div>
              </div>

              {/* Badge del código escaneado */}
              <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", background: "white" }}>
                <div style={{
                  padding: "10px 14px",
                  background: "linear-gradient(135deg, var(--teal-100) 0%, var(--teal-200) 100%)",
                  border: "3px solid var(--teal-500)",
                  borderRadius: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  fontWeight: 900,
                  fontSize: 15,
                  color: "var(--teal-900)",
                  boxShadow: "0 4px 12px rgba(13,158,126,0.3)"
                }}>
                  {searchResult.barcode.talle && (
                    <span style={{
                      padding: "4px 10px",
                      background: "white",
                      border: "2px solid var(--teal-400)",
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 900,
                      color: "var(--text)"
                    }}>
                      {searchResult.barcode.talle}
                    </span>
                  )}
                  {searchResult.barcode.color && <span>{searchResult.barcode.color}</span>}
                  <span style={{
                    background: "var(--teal-600)",
                    color: "white",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 14,
                    fontWeight: 900
                  }}>
                    Stock: {searchResult.barcode.cantidad}
                  </span>
                </div>
              </div>

              {/* Botones */}
              <div style={{
                padding: "14px 18px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                background: "var(--bg)"
              }}>
                <button
                  type="button"
                  onClick={() => openBarcodeModal(searchResult.producto)}
                  style={{
                    padding: "10px 18px",
                    background: "linear-gradient(135deg, var(--teal-500) 0%, var(--teal-600) 100%)",
                    border: "none",
                    borderRadius: 10,
                    color: "white",
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(13,158,126,0.3)"
                  }}
                >
                  ➕ Agregar Stock
                </button>
                <button
                  type="button"
                  onClick={() => openPrintModal({
                    ...searchResult.producto,
                    barcodes: [searchResult.barcode]
                  })}
                  style={{
                    padding: "10px 18px",
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    border: "none",
                    borderRadius: 10,
                    color: "white",
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(59,130,246,0.3)"
                  }}
                >
                  🏷️ Etiqueta
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {sortedItems.length === 0 ? (
            <div className="empty">No hay productos para mostrar.</div>
          ) : (
            sortedItems.map((row) => {
              const barcodes = row.barcodes || [];

              // Agrupar por combinación única de talle + color
              const combinaciones = [];
              const seen = new Set();

              barcodes.forEach(b => {
                const key = `${b.talle || ''}-${b.color || ''}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  const stock = barcodes
                    .filter(bc => bc.talle === b.talle && bc.color === b.color)
                    .reduce((sum, bc) => sum + (bc.cantidad || 0), 0);

                  combinaciones.push({
                    talle: b.talle,
                    color: b.color,
                    stock: stock
                  });
                }
              });

              return (
                <div key={row.id} style={{
                  border: "2px solid var(--border)",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "white"
                }}>
                  {/* Header con título del producto */}
                  <div style={{ padding: "12px 16px", borderBottom: "2px solid var(--border)" }}>
                    <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: "var(--text)" }}>
                      {row.marca} - {row.tipo} - {row.codigo || "S/C"}
                    </h3>
                  </div>

                  {/* Badges de COSTO y PRECIO FINAL */}
                  <div style={{
                    padding: "14px 16px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    background: "var(--bg)"
                  }}>
                    {/* Badge COSTO */}
                    <div style={{
                      padding: "12px 16px",
                      background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                      border: "2px solid #fbbf24",
                      borderRadius: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#92400e", letterSpacing: "0.05em" }}>
                        COSTO
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#78350f" }}>
                        ${fmtMoney(row.costo)}
                      </div>
                    </div>

                    {/* Badge PRECIO FINAL */}
                    <div style={{
                      padding: "12px 16px",
                      background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
                      border: "2px solid #34d399",
                      borderRadius: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#065f46", letterSpacing: "0.05em" }}>
                        PRECIO FINAL
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#064e3b" }}>
                        ${fmtMoney(row.precioFinal)}
                      </div>
                    </div>
                  </div>

                  {/* Combinaciones Talle + Color */}
                  {combinaciones.length > 0 && (
                    <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "white" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
                        {combinaciones.map((combo, idx) => (
                          <div key={idx} style={{
                            padding: "6px 10px",
                            background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
                            border: "2px solid #34d399",
                            borderRadius: 6,
                            fontWeight: 800,
                            fontSize: 13,
                            color: "#065f46",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            whiteSpace: "nowrap"
                          }}>
                            {/* Talle en recuadro blanco */}
                            {combo.talle && (
                              <span style={{
                                padding: "2px 8px",
                                background: "white",
                                border: "1px solid #d1d5db",
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 900,
                                color: "#374151"
                              }}>
                                {combo.talle}
                              </span>
                            )}

                            {/* Color */}
                            {combo.color && (
                              <span>{combo.color}</span>
                            )}

                            {/* Stock */}
                            <span style={{
                              background: "#059669",
                              color: "white",
                              borderRadius: 4,
                              padding: "2px 6px",
                              fontSize: 12,
                              fontWeight: 900
                            }}>
                              {combo.stock}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botón Agregar Stock (verde y grande) */}
                  <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "white" }}>
                    <button
                      type="button"
                      onClick={() => openBarcodeModal(row)}
                      style={{
                        width: "100%",
                        padding: "11px 18px",
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        border: "none",
                        borderRadius: 8,
                        color: "white",
                        fontSize: 14,
                        fontWeight: 900,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        boxShadow: "0 3px 10px rgba(16,185,129,0.3)",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(16,185,129,0.4)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 3px 10px rgba(16,185,129,0.3)";
                      }}
                    >
                      <span style={{ fontSize: 16 }}>➕</span>
                      Agregar Stock
                    </button>
                  </div>

                  {/* Botones de acción secundarios */}
                  <div style={{
                    padding: "10px 16px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    gap: 6,
                    justifyContent: "flex-end",
                    background: "var(--bg)"
                  }}>
                    <button
                      type="button"
                      onClick={() => openPrintModal(row)}
                      disabled={!barcodes || barcodes.length === 0}
                      style={{
                        padding: "6px 12px",
                        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                        border: "none",
                        borderRadius: 6,
                        color: "white",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: barcodes.length > 0 ? "pointer" : "not-allowed",
                        opacity: barcodes.length > 0 ? 1 : 0.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        boxShadow: barcodes.length > 0 ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        if (barcodes.length > 0) {
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "0 4px 12px rgba(59,130,246,0.4)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (barcodes.length > 0) {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 2px 8px rgba(59,130,246,0.3)";
                        }
                      }}
                    >
                      <span style={{ fontSize: 14 }}>🏷️</span>
                      Etiquetas
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      style={{
                        padding: "6px 12px",
                        background: "white",
                        border: "2px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text)",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--primary)";
                        e.currentTarget.style.color = "var(--primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.color = "var(--text)";
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(row)}
                      style={{
                        padding: "6px 12px",
                        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        border: "none",
                        borderRadius: 6,
                        color: "white",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        boxShadow: "0 2px 8px rgba(239,68,68,0.3)",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(239,68,68,0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(239,68,68,0.3)";
                      }}
                    >
                      <span style={{ fontSize: 14 }}>🗑️</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
      )}

      {/* MODAL CÓDIGOS DE BARRAS */}
      {barcodeModalOpen && barcodeModalProducto && (
        <div className="modalOverlay" onMouseDown={() => closeBarcodeModal()}>
          <div className="modalCard modalLarge" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">
                Códigos de Barras - {barcodeModalProducto.marca} {barcodeModalProducto.tipo}
              </div>
              <button className="modalClose" onClick={closeBarcodeModal}>✕</button>
            </div>

            <div style={{ padding: "16px 0" }}>
              {barcodeModalMode === "menu" && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        padding: 20,
                        background: "linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.15) 100%)",
                        border: "2px solid rgba(59,130,246,0.3)"
                      }}
                      onClick={() => setBarcodeModalMode("escanear")}
                    >
                      <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>
                        Opción A: Escanear Código Existente
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>
                        Usar lectora de códigos o ingresar manualmente
                      </div>
                    </button>

                    <button
                      type="button"
                      className="btn"
                      style={{
                        padding: 20,
                        background: "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.15) 100%)",
                        border: "2px solid rgba(16,185,129,0.3)"
                      }}
                      onClick={() => setBarcodeModalMode("generar")}
                    >
                      <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>
                        Opción B: Generar Código Automático
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>
                        Sistema genera código secuencial (0000001, 0000002...)
                      </div>
                    </button>
                  </div>

                  <div className="modalActions" style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={handleListo}
                      style={{ flex: 1 }}
                    >
                      Listo - Terminar
                    </button>
                  </div>
                </>
              )}

              {barcodeModalMode === "escanear" && (
                <div className="form">
                  {/* Botón para cambiar a modo generar - ARRIBA */}
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeInput("");
                      setBarcodeErrors({});
                      setBarcodeModalMode("generar");
                    }}
                    style={{
                      width: "100%",
                      fontSize: 15,
                      padding: "16px 24px",
                      background: "white",
                      border: "2px solid var(--teal-300)",
                      borderRadius: 12,
                      color: "var(--teal-700)",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      marginBottom: 20,
                      boxShadow: "none"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--teal-50)";
                      e.currentTarget.style.borderColor = "var(--teal-500)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.borderColor = "var(--teal-300)";
                    }}
                  >
                    ¿No tiene código? Generar automático
                  </button>

                  <label className="field">
                    <span>Código de Barras *</span>
                    <input
                      className={barcodeErrors.barcode ? "inputError" : ""}
                      value={barcodeInput}
                      onChange={(e) => {
                        setBarcodeInput(e.target.value);
                        setBarcodeErrors((prev) => ({ ...prev, barcode: "" }));
                      }}
                      onBlur={async (e) => {
                        const codigo = e.target.value.trim();
                        if (!codigo) return;

                        // Verificar si el código ya existe
                        try {
                          const existing = await window.api.getBarcodeByCode({ barcode: codigo });
                          if (existing && existing.producto.id === barcodeModalProducto.id) {
                            // Código existe para este producto → abrir modal de incremento
                            setBarcodeToIncrement(existing);
                            setCantidadAIncrementar(1);
                            setIncrementModalOpen(true);
                          }
                        } catch (err) {
                          console.error("Error verificando código:", err);
                        }
                      }}
                      placeholder="Escaneá o ingresá el código..."
                      autoFocus
                    />
                    <div className="fieldErrorSlot">{barcodeErrors.barcode || " "}</div>
                  </label>

                  {parseTallesCSV(barcodeModalProducto.talles).length > 0 && (
                    <div className="field">
                      <span>Talle *</span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                        {parseTallesCSV(barcodeModalProducto.talles).map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={`tallePill ${barcodeTalle === t ? "tallePillActive" : ""}`}
                            onClick={() => {
                              setBarcodeTalle(t);
                              setBarcodeErrors((prev) => ({ ...prev, talle: "" }));
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <div className="fieldErrorSlot">{barcodeErrors.talle || " "}</div>
                    </div>
                  )}

                  {parseColores(barcodeModalProducto.colores).length > 0 && (
                    <div className="field">
                      <span>Color *</span>
                      <select
                        className={barcodeErrors.color ? "inputError" : ""}
                        value={barcodeColor}
                        onChange={(e) => {
                          setBarcodeColor(e.target.value);
                          setBarcodeErrors((prev) => ({ ...prev, color: "" }));
                        }}
                      >
                        <option value="">Seleccioná un color...</option>
                        {parseColores(barcodeModalProducto.colores).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <div className="fieldErrorSlot">{barcodeErrors.color || " "}</div>
                    </div>
                  )}

                  <label className="field">
                    <span>Cantidad</span>
                    <input
                      type="number"
                      min="1"
                      value={barcodeCantidad}
                      onChange={(e) => setBarcodeCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <div className="fieldErrorSlot">{" "}</div>
                  </label>

                  <div className="modalActions">
                    <button type="button" className="btn" onClick={closeBarcodeModal}>
                      Cancelar
                    </button>
                    <button type="button" className="btn primary" style={{ width: 200 }} onClick={handleEscanearCodigo}>
                      Guardar Código
                    </button>
                  </div>
                </div>
              )}

              {barcodeModalMode === "generar" && (
                <div className="form">
                  <div style={{
                    padding: 16,
                    background: "var(--green-soft)",
                    borderRadius: 8,
                    marginBottom: 16,
                    textAlign: "center"
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--muted)" }}>
                      Se generará automáticamente un código secuencial
                    </div>
                  </div>

                  {parseTallesCSV(barcodeModalProducto.talles).length > 0 && (
                    <div className="field">
                      <span>Talle *</span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                        {parseTallesCSV(barcodeModalProducto.talles).map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={`tallePill ${barcodeTalle === t ? "tallePillActive" : ""}`}
                            onClick={() => {
                              setBarcodeTalle(t);
                              setBarcodeErrors((prev) => ({ ...prev, talle: "" }));
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <div className="fieldErrorSlot">{barcodeErrors.talle || " "}</div>
                    </div>
                  )}

                  {parseColores(barcodeModalProducto.colores).length > 0 && (
                    <div className="field">
                      <span>Color *</span>
                      <select
                        className={barcodeErrors.color ? "inputError" : ""}
                        value={barcodeColor}
                        onChange={(e) => {
                          setBarcodeColor(e.target.value);
                          setBarcodeErrors((prev) => ({ ...prev, color: "" }));
                        }}
                      >
                        <option value="">Seleccioná un color...</option>
                        {parseColores(barcodeModalProducto.colores).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <div className="fieldErrorSlot">{barcodeErrors.color || " "}</div>
                    </div>
                  )}

                  <label className="field">
                    <span>Cantidad</span>
                    <input
                      type="number"
                      min="1"
                      value={barcodeCantidad}
                      onChange={(e) => setBarcodeCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <div className="fieldErrorSlot">{" "}</div>
                  </label>

                  {/* Botón para volver a escanear */}
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeErrors({});
                      setBarcodeModalMode("escanear");
                    }}
                    style={{
                      width: "100%",
                      fontSize: 15,
                      padding: "16px 24px",
                      background: "white",
                      border: "2px solid var(--teal-300)",
                      borderRadius: 12,
                      color: "var(--teal-700)",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      marginBottom: 20,
                      boxShadow: "none"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--teal-50)";
                      e.currentTarget.style.borderColor = "var(--teal-500)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.borderColor = "var(--teal-300)";
                    }}
                  >
                    ¿Tiene código físico? Escanear
                  </button>

                  <div className="modalActions">
                    <button type="button" className="btn" onClick={closeBarcodeModal}>
                      Cancelar
                    </button>
                    <button type="button" className="btn primary" style={{ width: 200 }} onClick={handleGenerarCodigo}>
                      Generar Código
                    </button>
                  </div>
                </div>
              )}

              {barcodeModalMode === "success" && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{
                    fontSize: 56,
                    marginBottom: 16,
                    color: "var(--teal-500)"
                  }}>
                    ✓
                  </div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 900,
                    marginBottom: 8,
                    color: "var(--text)"
                  }}>
                    Código guardado exitosamente
                  </div>
                  <div style={{
                    fontSize: 15,
                    color: "var(--muted)",
                    marginBottom: 24,
                    fontWeight: 700
                  }}>
                    Código: <strong style={{ color: "var(--teal-700)" }}>{codigoGenerado}</strong>
                  </div>

                  <div className="modalActions" style={{
                    justifyContent: "center",
                    gap: 12,
                    borderTop: "none",
                    paddingTop: 0
                  }}>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={handleAgregarOtroCodigo}
                      style={{ flex: 1, maxWidth: 220 }}
                    >
                      Agregar Otro Código
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={handleVolverAlMenu}
                      style={{ width: 140 }}
                    >
                      Volver al Menú
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={handleListo}
                      style={{ width: 100 }}
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {editing && (
        <div className="modalOverlay" onMouseDown={() => setEditing(false)}>
          <div className="modalCard modalLarge" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Editar Producto</div>
              <button type="button" className="modalClose" onClick={() => setEditing(false)}>
                ✕
              </button>
            </div>

            <form className="form" onSubmit={onSubmitEdit}>
              <div className="grid2">
                <MarcaComboField
                  label="Marca *"
                  value={editMarca}
                  query={editMarcaQuery}
                  open={editMarcaOpen}
                  filtradas={filteredMarcasEdit}
                  showAdd={editMarcaShowAdd}
                  newName={editMarcaNewName}
                  error={errors.marca}
                  onFocus={() => {
                    setEditMarcaOpen(false);
                    setEditMarcaQuery("");
                    setEditMarcaShowAdd(false);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditMarca(val);
                    setEditMarcaQuery(val);
                    const filtered = allBrands.filter((b) => b.toLowerCase().startsWith(val.toLowerCase().trim()));
                    setEditMarcaOpen(!!val.trim());
                    setEditMarcaShowAdd(!!val.trim() && filtered.length === 0);
                    setEditMarcaNewName(val);
                    clearError("marca");
                  }}
                  onBlur={() => setTimeout(() => setEditMarcaOpen(false), 150)}
                  onSelect={(b) => {
                    setEditMarca(b);
                    setEditMarcaQuery("");
                    setEditMarcaOpen(false);
                    setEditMarcaShowAdd(false);
                    clearError("marca");
                  }}
                  onNewNameChange={setEditMarcaNewName}
                  onAddConfirm={addMarcaEdit}
                />

                <TipoComboField
                  label="Tipo *"
                  value={editTipo}
                  query={editTipoQuery}
                  open={editTipoOpen}
                  filtrados={filteredTiposEdit}
                  error={errors.tipo}
                  showAdd={editTipoShowAdd}
                  newName={editTipoNewName}
                  onFocus={() => {
                    setEditTipoOpen(true);
                    setEditTipoQuery("");
                    setEditTipoShowAdd(false);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditTipo(val);
                    setEditTipoQuery(val);
                    setEditTipoOpen(true);
                    const filtered = allTipos.filter((t) => t.nombre.toLowerCase().startsWith(val.toLowerCase().trim()));
                    setEditTipoShowAdd(!!val.trim() && filtered.length === 0);
                    setEditTipoNewName(val);
                    clearError("tipo");
                  }}
                  onBlur={() => setTimeout(() => setEditTipoOpen(false), 150)}
                  onSelect={(t) => {
                    setEditTipo(t);
                    setEditTipoQuery("");
                    setEditTipoOpen(false);
                    setEditTipoShowAdd(false);
                    clearError("tipo");
                  }}
                  onNewNameChange={setEditTipoNewName}
                  onAddConfirm={() => handleAddTipo(true)}
                />
              </div>

              <label className="field">
                <span>Código *</span>
                <input
                  className={errors.codigo ? "inputError" : ""}
                  value={editCodigo}
                  onChange={(e) => {
                    setEditCodigo(e.target.value);
                    clearError("codigo");
                  }}
                />
                <div className="fieldErrorSlot">{errors.codigo || " "}</div>
              </label>

              <div className="grid2">
                <label className="field">
                  <span>Costo</span>
                  <input
                    value={formatMiles(editCosto)}
                    onChange={(e) => handleNumInput(e, setEditCosto)}
                    inputMode="numeric"
                    placeholder="Ej: 25.000"
                  />
                  <div className="fieldErrorSlot">{" "}</div>
                </label>

                <label className="field">
                  <span>Precio final</span>
                  <input
                    value={formatMiles(editPrecioFinal)}
                    onChange={(e) => handleNumInput(e, setEditPrecioFinal)}
                    inputMode="numeric"
                    placeholder="Ej: 35.000"
                  />
                  <div className="fieldErrorSlot">{" "}</div>
                </label>
              </div>

              <div className="multRow">
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-medium)", marginRight: 8 }}>
                  Multiplicadores:
                </span>
                {MULTIPLICADORES.map((m) => (
                  <button key={m} type="button" className="multBtn" onClick={() => applyMultiplier(m, editCosto, setEditPrecioFinal)}>
                    ×{m}
                  </button>
                ))}
              </div>

              <div className="field">
                <span style={{ fontSize: 13, color: "rgba(15,23,42,0.65)", fontWeight: 800 }}>Talles disponibles</span>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 8 }}>
                  Nota: Los talles ya asignados a códigos no se pueden eliminar aquí
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["ÚNICO", ...getCurvaForTipo(editTipo)].map((t) => {
                    const active = editTalles.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`tallePill ${active ? "tallePillActive" : ""}`}
                        onClick={() => {
                          if (active) {
                            setEditTalles((prev) => prev.filter((x) => x !== t));
                          } else {
                            setEditTalles((prev) => [...prev, t]);
                          }
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <div className="fieldErrorSlot">{" "}</div>
              </div>

              <div className="field">
                <span style={{ fontSize: 13, color: "rgba(15,23,42,0.65)", fontWeight: 800 }}>Colores disponibles</span>
                <div className="chipInputBox">
                  {editColores.map((c) => (
                    <span key={c} className="chip">
                      {c}
                      <button type="button" className="chipRemove" onClick={() => removeColor(c, setEditColores)}>
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    className="chipInput"
                    value={editColorInput}
                    onChange={(e) => setEditColorInput(e.target.value)}
                    onKeyDown={(e) => handleColorKey(e, editColores, setEditColores, editColorInput, setEditColorInput)}
                    onBlur={() => {
                      if (editColorInput.trim()) addColor(editColorInput, editColores, setEditColores, setEditColorInput);
                    }}
                    placeholder={editColores.length === 0 ? "Escribí y presioná Enter para agregar" : "Agregar color..."}
                  />
                </div>
                <div className="fieldErrorSlot">{" "}</div>
              </div>

              <div className="modalActions">
                <button type="button" className="btn" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary" style={{ width: 220 }}>
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR PRODUCTO */}
      {deleteModalOpen && itemToDelete && (
        <div className="modalOverlay" onMouseDown={() => { if (!deleting) { setDeleteModalOpen(false); setItemToDelete(null); } }}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar eliminación</div>
              <button type="button" className="modalClose" onClick={() => { if (!deleting) { setDeleteModalOpen(false); setItemToDelete(null); } }}>
                ✕
              </button>
            </div>
            <div style={{ padding: "10px 0 18px 0", fontWeight: 600 }}>
              ¿Querés eliminar <b>{itemToDelete.marca} {itemToDelete.tipo}</b>?
            </div>
            <div style={{ padding: "10px 0", fontSize: 13, color: "var(--danger)", fontWeight: 700 }}>
              Esto eliminará el producto y todos sus códigos de barras.
            </div>
            <div className="modalActions">
              <button type="button" className="btn" onClick={() => { if (!deleting) { setDeleteModalOpen(false); setItemToDelete(null); } }}>
                Cancelar
              </button>
              <button type="button" className="btn danger" onClick={confirmDelete} disabled={deleting} style={{ width: 200 }}>
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR CÓDIGO INDIVIDUAL */}
      {editBarcodeModalOpen && editingBarcode && (
        <div className="modalOverlay" onMouseDown={() => setEditBarcodeModalOpen(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Editar Cantidad</div>
              <button className="modalClose" onClick={() => setEditBarcodeModalOpen(false)}>✕</button>
            </div>
            <div style={{ padding: "16px 0" }}>
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 12 }}>
                Código: {editingBarcode.barcode}
              </div>
              <label className="field">
                <span>Nueva cantidad</span>
                <input
                  type="number"
                  min="0"
                  value={editBarcodeCantidad}
                  onChange={(e) => setEditBarcodeCantidad(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <div className="fieldErrorSlot">{" "}</div>
              </label>
            </div>
            <div className="modalActions">
              <button type="button" className="btn" onClick={() => setEditBarcodeModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn primary" onClick={handleSaveEditBarcode} style={{ width: 160 }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR CÓDIGO */}
      {deleteBarcodeModalOpen && barcodeToDelete && (
        <div className="modalOverlay" onMouseDown={() => setDeleteBarcodeModalOpen(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Confirmar eliminación</div>
              <button className="modalClose" onClick={() => setDeleteBarcodeModalOpen(false)}>✕</button>
            </div>
            <div style={{ padding: "10px 0 18px 0", fontWeight: 600 }}>
              ¿Querés eliminar el código <b>{barcodeToDelete.barcode}</b>?
            </div>
            <div className="modalActions">
              <button type="button" className="btn" onClick={() => setDeleteBarcodeModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn danger" onClick={confirmDeleteBarcode} style={{ width: 200 }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CURVA */}
      {curvaModalOpen && (
        <div className="modalOverlay">
          <div className="modalCard" style={{ maxWidth: 400 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">¿Qué talles usa "{curvaModalNombre}"?</div>
            </div>
            <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (curvaModalResolve) curvaModalResolve("letras");
                  setCurvaModalOpen(false);
                }}
              >
                Talles por letras (S, M, L, XL, XXL)
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (curvaModalResolve) curvaModalResolve("numericos");
                  setCurvaModalOpen(false);
                }}
              >
                Talles numéricos (40, 42, 44...)
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (curvaModalResolve) curvaModalResolve("none");
                  setCurvaModalOpen(false);
                }}
              >
                No usa talles
              </button>
            </div>
            <div className="modalActions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (curvaModalResolve) curvaModalResolve(null);
                  setCurvaModalOpen(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INCREMENTAR CÓDIGO EXISTENTE */}
      {incrementModalOpen && barcodeToIncrement && (
        <div className="modalOverlay" onMouseDown={() => setIncrementModalOpen(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Código ya existe</div>
              <button className="modalClose" onClick={() => setIncrementModalOpen(false)}>✕</button>
            </div>
            <div style={{ padding: "20px 0" }}>
              <div style={{
                padding: 16,
                background: "var(--yellow-soft)",
                borderRadius: 8,
                marginBottom: 16
              }}>
                <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 8, color: "var(--text)" }}>
                  Este código ya existe para este producto:
                </div>
                <div style={{ fontSize: 14, color: "var(--muted)", fontWeight: 700 }}>
                  <div>Código: <strong>{barcodeToIncrement.barcode}</strong></div>
                  {barcodeToIncrement.talle && <div>Talle: <strong>{barcodeToIncrement.talle}</strong></div>}
                  {barcodeToIncrement.color && <div>Color: <strong>{barcodeToIncrement.color}</strong></div>}
                  <div>Stock actual: <strong>{barcodeToIncrement.cantidad}</strong></div>
                </div>
              </div>

              <label className="field">
                <span>¿Cuántas unidades querés agregar?</span>
                <input
                  type="number"
                  min="1"
                  value={cantidadAIncrementar}
                  onChange={(e) => setCantidadAIncrementar(Math.max(1, parseInt(e.target.value) || 1))}
                  autoFocus
                />
                <div className="fieldErrorSlot">{" "}</div>
              </label>

              <div style={{
                padding: 12,
                background: "var(--green-soft)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text)"
              }}>
                Stock anterior: {barcodeToIncrement.cantidad} → Nuevo stock: {barcodeToIncrement.cantidad + cantidadAIncrementar}
              </div>
            </div>

            <div className="modalActions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setIncrementModalOpen(false);
                  setBarcodeToIncrement(null);
                  setCantidadAIncrementar(1);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={confirmarIncrementoCodigo}
                style={{ width: 200 }}
              >
                Incrementar Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPRIMIR ETIQUETAS */}
      {printModalOpen && printProducto && (
        <PrintLabel
          producto={printProducto}
          barcodes={printProducto.barcodes || []}
          onClose={() => {
            setPrintModalOpen(false);
            setPrintProducto(null);
          }}
        />
      )}

      {/* MODAL DE ESCANEO UNIVERSAL */}
      <ModalEscaneoBarcode
        isOpen={modalEscaneoOpen}
        onClose={() => setModalEscaneoOpen(false)}
        onCodeScanned={handleSearchBarcodeFromModal}
        title="Buscar Producto por Código"
      />

      {/* TOAST */}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
