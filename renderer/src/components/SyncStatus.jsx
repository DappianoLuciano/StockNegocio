import { useEffect, useState } from "react";

const ESTADOS = {
  ok: { color: "#10b981", texto: "Sincronizado con la web" },
  sincronizando: { color: "#3b82f6", texto: "Sincronizando..." },
  "sin-conexion": { color: "#f59e0b", texto: "Sin conexión: se guarda y sube al volver" },
  "sin-configurar": { color: "#94a3b8", texto: "Sin vincular con la web" },
  error: { color: "#ef4444", texto: "Error de sincronización" },
  iniciando: { color: "#94a3b8", texto: "Iniciando..." },
};

function hace(iso) {
  if (!iso) return "";
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return "recién";
  const min = Math.round(seg / 60);
  return min < 60 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`;
}

export default function SyncStatus() {
  const [status, setStatus] = useState(null);
  const [vinculando, setVinculando] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!window.api?.getSyncStatus) return;
    window.api.getSyncStatus().then(setStatus).catch(() => {});
    const off = window.api.onSyncStatus(setStatus);
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => {
      off?.();
      clearInterval(t);
    };
  }, []);

  if (!status) return null;
  const info = ESTADOS[status.estado] || ESTADOS.iniciando;

  async function vincular(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      setStatus(await window.api.linkSync({ email, password }));
      setVinculando(false);
      setPassword("");
    } catch (err) {
      setError((err?.message || "No se pudo vincular").replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ fontSize: 12, lineHeight: 1.4, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#1f2937" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: info.color, flexShrink: 0 }} />
        <span>{status.mensaje && status.estado === "sincronizando" ? status.mensaje : info.texto}</span>
      </div>

      <div style={{ color: "#64748b", marginTop: 2 }}>
        {status.pendientes > 0 && <div>{status.pendientes} cambios por subir</div>}
        {status.estado === "ok" && status.ultimaSync && <div>Última: {hace(status.ultimaSync)}</div>}
        {status.estado === "error" && status.mensaje && <div>{status.mensaje}</div>}
      </div>

      {status.stockNegativo > 0 && (
        <div style={{ marginTop: 6, padding: "6px 8px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontWeight: 600 }}>
          {status.stockNegativo} {status.stockNegativo === 1 ? "código quedó" : "códigos quedaron"} con stock negativo
          (se vendió en el local y en la web). Revisá el inventario.
        </div>
      )}

      {status.estado === "sin-configurar" && !vinculando && (
        <button type="button" className="sideItem" style={{ marginTop: 6 }} onClick={() => setVinculando(true)}>
          Vincular con la web
        </button>
      )}

      {vinculando && (
        <form onSubmit={vincular} style={{ marginTop: 6, display: "grid", gap: 6 }}>
          <div style={{ color: "#64748b" }}>Usá el mismo usuario del panel de la web. Se hace una sola vez.</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email del panel"
            autoFocus
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}
          />
          {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="submit" className="sideItem" style={{ flex: 1 }} disabled={enviando}>{enviando ? "Vinculando..." : "Vincular"}</button>
            <button type="button" className="sideItem" style={{ flex: 1 }} onClick={() => setVinculando(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {(status.estado === "ok" || status.estado === "sin-conexion" || status.estado === "error") && (
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => window.api.syncNow().then(setStatus)}
            style={{ background: "none", border: "none", padding: 0, color: "#2563eb", cursor: "pointer", fontSize: 12 }}
          >
            Sincronizar ahora
          </button>
          {status.vinculado && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("¿Dejar de sincronizar esta PC con la web? Los datos de esta PC no se borran.")) {
                  window.api.unlinkSync().then(setStatus);
                }
              }}
              style={{ background: "none", border: "none", padding: 0, color: "#64748b", cursor: "pointer", fontSize: 12 }}
            >
              Desvincular
            </button>
          )}
        </div>
      )}
    </div>
  );
}
