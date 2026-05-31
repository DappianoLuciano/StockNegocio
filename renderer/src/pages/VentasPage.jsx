import { useEffect, useState, useRef } from "react";
import ModalEscaneoBarcode from "../components/ModalEscaneoBarcode";

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

function fmtDateTime(s) {
  if (!s) return "-";
  const d = new Date(s);
  const fecha = d.toLocaleDateString("es-AR");
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fecha} ${hora}`;
}

const METODOS_PAGO = ["Efectivo", "Débito", "Crédito", "Transferencia"];

export default function VentasPage() {
  // Lote abierto
  const [loteAbierto, setLoteAbierto] = useState(null);
  const [itemsLote, setItemsLote] = useState([]);

  // Escaneo de código
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState("");
  const inputRef = useRef(null);
  const [modalEscaneoOpen, setModalEscaneoOpen] = useState(false);

  // Cliente y método de pago
  const [cliente, setCliente] = useState("");
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [descuentoEfectivo, setDescuentoEfectivo] = useState(false);

  // Historial
  const [lotesCerrados, setLotesCerrados] = useState([]);
  const [loteExpandido, setLoteExpandido] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modales
  const [cancelarLoteModal, setCancelarLoteModal] = useState(false);
  const [cerrarLoteModal, setCerrarLoteModal] = useState(false);
  const [deleteLoteModal, setDeleteLoteModal] = useState(false);
  const [loteToDelete, setLoteToDelete] = useState(null);

  // Toast
  const [toastMsg, setToastMsg] = useState("");

  function showToast(msg) {
    setToastMsg(msg);
    window.clearTimeout(window.__toastTimerVentas);
    window.__toastTimerVentas = window.setTimeout(() => setToastMsg(""), 2500);
  }

  async function loadLoteAbierto() {
    try {
      const lote = await window.api.getLoteAbierto();
      if (lote) {
        setLoteAbierto(lote);
        setItemsLote(lote.items || []);
        setCliente(lote.cliente || "");
        setMetodoPago(lote.metodoPago || "Efectivo");
      } else {
        setLoteAbierto(null);
        setItemsLote([]);
        setCliente("");
        setMetodoPago("Efectivo");
        setDescuentoEfectivo(false);
      }
    } catch (err) {
      console.error("Error cargando lote abierto:", err);
    }
  }

  async function loadHistorial() {
    try {
      setLoading(true);
      const lotes = await window.api.listLotes();
      setLotesCerrados(lotes || []);
    } catch (err) {
      showToast(err?.message || "Error cargando historial");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLoteAbierto();
    loadHistorial();
  }, []);

  // Crear nuevo lote
  async function handleCrearLote() {
    try {
      const nuevoLote = await window.api.createLote();
      setLoteAbierto(nuevoLote);
      setItemsLote([]);
      setCliente("");
      setMetodoPago("Efectivo");
      setDescuentoEfectivo(false);
      showToast("✓ Nuevo lote creado");
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      showToast(err?.message || "Error creando lote");
    }
  }

  // Escanear código desde modal y agregar al lote
  async function handleEscanearCodigoFromModal(codigo) {
    try {
      // Buscar el código en la base de datos
      const result = await window.api.getBarcodeByCode({ barcode: codigo });

      if (!result) {
        showToast("❌ Código no encontrado");
        throw new Error("Código no encontrado");
      }

      // Verificar stock disponible
      if (result.cantidad <= 0) {
        showToast("❌ Sin stock disponible");
        throw new Error("Sin stock disponible");
      }

      // Agregar al lote
      await window.api.addVentaLote({
        loteId: loteAbierto.id,
        barcodeId: result.id,
        cantidad: 1,
        precioVenta: result.producto.precioFinal || 0,
      });

      // Recargar lote
      await loadLoteAbierto();
      showToast(`✓ Agregado: ${result.producto.marca} ${result.producto.tipo}`);
      setModalEscaneoOpen(false); // Cerrar modal

    } catch (err) {
      throw err; // Propagar error para que el modal lo maneje
    }
  }

  // Escanear código y agregar al lote (input tradicional - mantener por compatibilidad)
  async function handleEscanearCodigo(e) {
    e.preventDefault();
    const codigo = barcodeInput.trim();
    if (!codigo) return;

    setBarcodeError("");

    try {
      await handleEscanearCodigoFromModal(codigo);
      setBarcodeInput("");
    } catch (err) {
      setBarcodeError(err?.message || "Error agregando producto");
      setBarcodeInput("");
    }
  }

  // Quitar producto del lote
  async function handleQuitarItem(itemId) {
    try {
      await window.api.removeVentaLote({ id: itemId });
      await loadLoteAbierto();
      showToast("✓ Producto quitado");
    } catch (err) {
      showToast(err?.message || "Error quitando producto");
    }
  }

  // Actualizar precio de venta (editable en input)
  async function handleUpdatePrecio(itemId, nuevoPrecio) {
    const precio = Number(nuevoPrecio);
    if (isNaN(precio) || precio < 0) return;

    try {
      await window.api.updatePrecioVenta({
        id: itemId,
        precioVenta: precio,
      });
      await loadLoteAbierto();
    } catch (err) {
      showToast(err?.message || "Error actualizando precio");
    }
  }

  // Actualizar cliente
  async function handleUpdateCliente(nuevoCliente) {
    if (!loteAbierto) return;
    try {
      await window.api.updateCliente({
        id: loteAbierto.id,
        cliente: nuevoCliente,
      });
      setCliente(nuevoCliente);
    } catch (err) {
      showToast(err?.message || "Error actualizando cliente");
    }
  }

  // Actualizar método de pago
  async function handleUpdateMetodoPago(metodo) {
    if (!loteAbierto) return;
    try {
      await window.api.updateMetodoPago({
        id: loteAbierto.id,
        metodoPago: metodo,
      });
      setMetodoPago(metodo);
      // Si no es efectivo, deshabilitar descuento
      if (metodo !== "Efectivo") {
        setDescuentoEfectivo(false);
      }
    } catch (err) {
      showToast(err?.message || "Error actualizando método de pago");
    }
  }

  // Cancelar lote
  async function confirmarCancelarLote() {
    if (!loteAbierto) return;

    try {
      await window.api.deleteLote({ id: loteAbierto.id });
      await loadLoteAbierto();
      await loadHistorial();
      showToast("✓ Lote cancelado");
      setCancelarLoteModal(false);
    } catch (err) {
      showToast(err?.message || "Error cancelando lote");
    }
  }

  // Cerrar lote (finalizar venta)
  async function confirmarCerrarLote() {
    if (!loteAbierto) return;
    if (itemsLote.length === 0) {
      showToast("❌ El lote está vacío");
      setCerrarLoteModal(false);
      return;
    }

    try {
      const totalFinal = descuentoEfectivo ? totalLote * 0.85 : totalLote;

      await window.api.closeLote({
        id: loteAbierto.id,
        metodoPago: metodoPago,
        total: totalFinal,
      });
      await loadLoteAbierto();
      await loadHistorial();
      showToast("✓ Venta registrada y stock descontado");
      setCerrarLoteModal(false);
    } catch (err) {
      showToast(err?.message || "Error cerrando lote");
    }
  }

  // Eliminar lote del historial
  async function handleEliminarLote() {
    if (!loteToDelete) return;

    try {
      await window.api.deleteLote({ id: loteToDelete.id });
      await loadHistorial();
      showToast("✓ Lote eliminado del historial");
      setDeleteLoteModal(false);
      setLoteToDelete(null);
    } catch (err) {
      showToast(err?.message || "Error eliminando lote");
    }
  }

  // Calcular total del lote (sin descuento)
  const totalLote = itemsLote.reduce((sum, item) => sum + (item.precioVenta || 0), 0);

  // Total final con descuento si aplica
  const totalFinal = descuentoEfectivo ? totalLote * 0.85 : totalLote;

  return (
    <div className="page">
      <h2>Ventas</h2>

      {/* LOTE ABIERTO */}
      {loteAbierto ? (
        <section className="card">
          <h3 style={{ marginBottom: 20 }}>Lote Abierto</h3>

          {/* Escaneo de código */}
          <button
            className="btn primary"
            onClick={() => setModalEscaneoOpen(true)}
            style={{ width: "100%", fontSize: 16, padding: "16px", marginBottom: 20 }}
          >
            📷 Escanear Código de Barras
          </button>

          {/* Cliente y método de pago */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <label className="field">
              <span>Cliente (opcional)</span>
              <input
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                onBlur={(e) => handleUpdateCliente(e.target.value)}
                placeholder="Nombre del cliente..."
              />
            </label>

            <label className="field">
              <span>Método de pago</span>
              <select
                value={metodoPago}
                onChange={(e) => handleUpdateMetodoPago(e.target.value)}
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Checkbox descuento 15% efectivo */}
          {metodoPago === "Efectivo" && itemsLote.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={descuentoEfectivo}
                  onChange={(e) => setDescuentoEfectivo(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>
                  Aplicar descuento 15% por pago en efectivo
                </span>
              </label>
            </div>
          )}

          {/* Lista de productos en el lote */}
          {itemsLote.length === 0 ? (
            <div className="hint" style={{ textAlign: "center", padding: 40 }}>
              Escaneá códigos para agregar productos al lote
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12, fontWeight: 800, fontSize: 13, color: "var(--muted)" }}>
                PRODUCTOS EN EL LOTE ({itemsLote.length})
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {itemsLote.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                    }}
                  >
                    {/* Info del producto */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 15, color: "var(--text)", marginBottom: 4 }}>
                        {item.producto?.marca} {item.producto?.tipo}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>
                        Código: {item.barcode?.barcode}
                        {item.barcode?.talle && ` • Talle: ${item.barcode.talle}`}
                        {item.barcode?.color && ` • Color: ${item.barcode.color}`}
                      </div>
                    </div>

                    {/* Precio editable */}
                    <div style={{ width: 140 }}>
                      <input
                        type="text"
                        value={formatMiles(item.precioVenta)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\./g, "").replace(/\D/g, "");
                          // Actualizar localmente mientras se escribe
                          const updatedItems = itemsLote.map(i =>
                            i.id === item.id ? { ...i, precioVenta: Number(raw) || 0 } : i
                          );
                          setItemsLote(updatedItems);
                        }}
                        onBlur={(e) => {
                          const raw = e.target.value.replace(/\./g, "").replace(/\D/g, "");
                          handleUpdatePrecio(item.id, raw);
                        }}
                        placeholder="Precio"
                        style={{ textAlign: "right", fontWeight: 900, fontSize: 15 }}
                      />
                    </div>

                    {/* Botón quitar */}
                    <button
                      type="button"
                      onClick={() => handleQuitarItem(item.id)}
                      style={{
                        padding: "8px 12px",
                        background: "var(--danger-soft)",
                        color: "var(--danger)",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 900,
                        fontSize: 14,
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div
                style={{
                  padding: "16px 20px",
                  background: "linear-gradient(135deg, var(--teal-500) 0%, var(--teal-600) 100%)",
                  borderRadius: 12,
                  marginBottom: 16,
                }}
              >
                {descuentoEfectivo && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                      Subtotal
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)", textDecoration: "line-through" }}>
                      ${fmtMoney(totalLote)}
                    </div>
                  </div>
                )}
                {descuentoEfectivo && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                      Descuento 15%
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                      -${fmtMoney(totalLote * 0.15)}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "white" }}>
                    TOTAL
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "white" }}>
                    ${fmtMoney(totalFinal)}
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  className="btn"
                  onClick={() => setCancelarLoteModal(true)}
                  type="button"
                  style={{ minWidth: 140 }}
                >
                  Cancelar Lote
                </button>
                <button
                  className="btn primary"
                  onClick={() => setCerrarLoteModal(true)}
                  type="button"
                  disabled={itemsLote.length === 0}
                  style={{ minWidth: 140 }}
                >
                  Cerrar Lote
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        /* No hay lote abierto */
        <section className="card">
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--muted)", marginBottom: 20 }}>
              No hay un lote de venta abierto
            </div>
            <button className="btn primary" onClick={handleCrearLote} type="button">
              Crear Nuevo Lote
            </button>
          </div>
        </section>
      )}

      {/* HISTORIAL DE LOTES CERRADOS */}
      <section className="card" style={{ marginTop: 20 }}>
        <div className="rowBetween" style={{ marginBottom: 20 }}>
          <h3>Historial de Ventas</h3>
          <button className="btn" onClick={loadHistorial} disabled={loading} type="button">
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>

        {lotesCerrados.length === 0 ? (
          <div className="hint" style={{ textAlign: "center", padding: 40 }}>
            No hay ventas registradas
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lotesCerrados.map((lote) => {
              const expanded = loteExpandido === lote.id;
              const totalLoteHist = (lote.items || []).reduce((sum, item) => sum + (item.precioVenta || 0), 0);

              return (
                <div
                  key={lote.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  {/* Header del lote */}
                  <div
                    style={{
                      padding: "14px 18px",
                      background: "var(--card)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                    }}
                    onClick={() => setLoteExpandido(expanded ? null : lote.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 15, color: "var(--text)", marginBottom: 4 }}>
                        {lote.cliente || "Sin cliente"}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>
                        {fmtDateTime(lote.closedAt)} • {lote.metodoPago} • {lote.items?.length || 0} productos
                      </div>
                    </div>

                    <div style={{
                      padding: "8px 16px",
                      background: "linear-gradient(135deg, var(--teal-100) 0%, var(--teal-200) 100%)",
                      borderRadius: 8,
                      fontWeight: 900,
                      fontSize: 16,
                      color: "var(--teal-900)",
                    }}>
                      ${fmtMoney(lote.total || totalLoteHist)}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLoteToDelete(lote);
                        setDeleteLoteModal(true);
                      }}
                      style={{
                        padding: "8px 12px",
                        background: "transparent",
                        color: "var(--danger)",
                        border: "1px solid var(--danger)",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 900,
                        fontSize: 14,
                      }}
                    >
                      Eliminar
                    </button>

                    <div style={{ fontSize: 20, color: "var(--muted)" }}>
                      {expanded ? "▲" : "▼"}
                    </div>
                  </div>

                  {/* Detalle de productos */}
                  {expanded && (
                    <div style={{ padding: "16px 18px", background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                        PRODUCTOS VENDIDOS
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(lote.items || []).map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "10px 14px",
                              background: "white",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 900, fontSize: 14, color: "var(--text)" }}>
                                {item.producto?.marca} {item.producto?.tipo}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>
                                {item.barcode?.barcode}
                                {item.barcode?.talle && ` • Talle: ${item.barcode.talle}`}
                                {item.barcode?.color && ` • ${item.barcode.color}`}
                              </div>
                            </div>
                            <div style={{ fontWeight: 900, fontSize: 15, color: "var(--text)" }}>
                              ${fmtMoney(item.precioVenta)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL CANCELAR LOTE */}
      {cancelarLoteModal && (
        <div className="modalOverlay" onMouseDown={() => setCancelarLoteModal(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Cancelar Lote</div>
              <button className="modalClose" onClick={() => setCancelarLoteModal(false)}>✕</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ marginBottom: 20, fontSize: 14, color: "var(--text)" }}>
                ¿Cancelar este lote? Los productos no se venderán.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => setCancelarLoteModal(false)} type="button">
                  No, volver
                </button>
                <button
                  className="btn"
                  onClick={confirmarCancelarLote}
                  type="button"
                  style={{ background: "var(--danger)", color: "white" }}
                >
                  Sí, cancelar lote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CERRAR LOTE */}
      {cerrarLoteModal && (
        <div className="modalOverlay" onMouseDown={() => setCerrarLoteModal(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Cerrar Lote</div>
              <button className="modalClose" onClick={() => setCerrarLoteModal(false)}>✕</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ marginBottom: 12, fontSize: 14, color: "var(--text)" }}>
                ¿Cerrar este lote y finalizar la venta?
              </p>
              <p style={{ marginBottom: 20, fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>
                Se descontará el stock de todos los productos.
              </p>
              <div style={{
                padding: "12px 16px",
                background: "var(--teal-50)",
                borderRadius: 8,
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>Total a cobrar:</span>
                <span style={{ fontWeight: 900, fontSize: 20, color: "var(--teal-900)" }}>
                  ${fmtMoney(totalFinal)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => setCerrarLoteModal(false)} type="button">
                  Cancelar
                </button>
                <button
                  className="btn primary"
                  onClick={confirmarCerrarLote}
                  type="button"
                >
                  Cerrar Lote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR LOTE */}
      {deleteLoteModal && loteToDelete && (
        <div className="modalOverlay" onMouseDown={() => setDeleteLoteModal(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Eliminar Lote</div>
              <button className="modalClose" onClick={() => setDeleteLoteModal(false)}>✕</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ marginBottom: 20, fontSize: 14, color: "var(--text)" }}>
                ¿Eliminar este lote del historial?
                <br />
                Esta acción no se puede deshacer.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => setDeleteLoteModal(false)} type="button">
                  Cancelar
                </button>
                <button
                  className="btn"
                  onClick={handleEliminarLote}
                  type="button"
                  style={{ background: "var(--danger)", color: "white" }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ESCANEO */}
      <ModalEscaneoBarcode
        isOpen={modalEscaneoOpen}
        onClose={() => setModalEscaneoOpen(false)}
        onCodeScanned={handleEscanearCodigoFromModal}
        title="Agregar Producto al Lote"
      />

      {/* TOAST */}
      {toastMsg && (
        <div className="toast">{toastMsg}</div>
      )}
    </div>
  );
}
