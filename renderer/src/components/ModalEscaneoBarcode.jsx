import { useEffect, useRef, useState } from "react";

export default function ModalEscaneoBarcode({
  isOpen,
  onClose,
  onCodeScanned,
  title = "Escanear Código de Barras"
}) {
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCodigo("");
      setBuscando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    const codigoLimpio = codigo.trim();

    if (!codigoLimpio) return;

    setBuscando(true);

    try {
      await onCodeScanned(codigoLimpio);
      // El modal se cierra desde el padre después de procesar
    } catch (err) {
      setBuscando(false);
      console.error("Error procesando código:", err);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modalCard" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button className="modalClose" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "20px 0" }}>
          {/* Indicador visual de escaneo */}
          <div style={{
            padding: "20px",
            background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.12) 100%)",
            border: "2px solid var(--teal-200)",
            borderRadius: 12,
            marginBottom: 20,
            textAlign: "center"
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--teal-800)" }}>
              {buscando ? "Buscando..." : "Esperando escaneo del código de barras..."}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{
              padding: "16px",
              background: "white",
              border: "2px solid var(--teal-300)",
              borderRadius: 12,
              marginBottom: 16
            }}>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-medium)",
                marginBottom: 12,
                textAlign: "center"
              }}>
                El código aparecerá aquí automáticamente
              </div>

              <input
                ref={inputRef}
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Esperando código..."
                autoFocus
                disabled={buscando}
                style={{
                  width: "100%",
                  fontSize: 18,
                  fontWeight: 700,
                  textAlign: "center",
                  fontFamily: "monospace",
                  letterSpacing: "0.05em",
                  color: "var(--teal-900)",
                  background: "var(--teal-50)",
                  border: "2px solid var(--teal-400)",
                  borderRadius: 10,
                  padding: "14px"
                }}
              />
            </div>

            <div style={{
              fontSize: 13,
              color: "var(--muted)",
              textAlign: "center",
              fontWeight: 600,
              marginBottom: 20
            }}>
              O escribí el código manualmente y presioná Enter
            </div>

            <button
              type="submit"
              className="btn primary"
              disabled={!codigo.trim() || buscando}
              style={{ width: "100%", fontSize: 15, padding: "14px" }}
            >
              {buscando ? "Buscando..." : "✓ Listo"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
