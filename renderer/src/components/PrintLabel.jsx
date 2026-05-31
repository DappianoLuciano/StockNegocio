import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import "./PrintLabel.css";

export default function PrintLabel({ producto, barcodes, onClose }) {
  const canvasRefs = useRef({});

  // Generar códigos de barras en los canvas
  useEffect(() => {
    if (!barcodes || barcodes.length === 0) return;

    barcodes.forEach((bc) => {
      const canvas = canvasRefs.current[bc.id];
      if (canvas && bc.barcode) {
        try {
          console.log(`🏷️ Generando barcode para: ${bc.barcode}`);

          // Función para sanitizar el código
          function sanitizarCodigo(codigo) {
            return codigo
              .toUpperCase()
              .replace(/Ñ/g, 'N')
              .replace(/[ÁÀÂÄ]/g, 'A')
              .replace(/[ÉÈÊË]/g, 'E')
              .replace(/[ÍÌÎÏ]/g, 'I')
              .replace(/[ÓÒÔÖ]/g, 'O')
              .replace(/[ÚÙÛÜ]/g, 'U')
              // Eliminar cualquier carácter que no sea válido en CODE39
              .replace(/[^A-Z0-9\-.$\/+% ]/g, '');
          }

          // Intentar detectar el mejor formato automáticamente
          let formato = "CODE128";
          let barcodeValue = bc.barcode;

          // Si contiene letras o guiones, usar CODE39
          if (/[A-Za-z-]/.test(bc.barcode)) {
            formato = "CODE39";
            barcodeValue = sanitizarCodigo(bc.barcode);
          }

          JsBarcode(canvas, barcodeValue, {
            format: formato,
            width: formato === "CODE39" ? 2 : 2.5,
            height: 180,
            displayValue: false, // No mostrar el valor dentro del barcode
            fontSize: 22,
            margin: 4,
            background: "#ffffff",
            lineColor: "#000000",
          });

          // Mostrar el código ORIGINAL debajo del barcode manualmente
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000';
          ctx.font = 'bold 22px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(bc.barcode, canvas.width / 2, canvas.height - 8);

          console.log(`✅ Barcode generado: ${bc.barcode} → ${barcodeValue} (formato: ${formato})`);
        } catch (err) {
          console.error(`❌ Error generando barcode ${bc.barcode}:`, err);
          // Mostrar error en el canvas
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fee';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#c00';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Error: Código inválido', canvas.width / 2, canvas.height / 2);
          ctx.fillText(bc.barcode, canvas.width / 2, canvas.height / 2 + 20);
        }
      }
    });
  }, [barcodes]);

  function handlePrint(barcodeId) {
    const bc = barcodes.find((b) => b.id === barcodeId);
    if (!bc) return;

    // Crear ventana de impresión con solo esta etiqueta
    const printWindow = window.open("", "_blank", "width=300,height=200");

    const etiquetaHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta ${bc.barcode}</title>
        <style>
          @page {
            size: 70mm 40mm;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            width: 70mm;
            height: 40mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            background: white;
            padding: 2mm;
          }
          .nombre {
            font-size: 9pt;
            font-weight: 900;
            text-align: center;
            margin-bottom: 2mm;
            width: 100%;
          }
          .detalles {
            font-size: 7pt;
            font-weight: 700;
            text-align: center;
            margin-bottom: 2mm;
            color: #333;
          }
          .barcode-container {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          canvas {
            max-width: 66mm;
            max-height: 28mm;
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      </head>
      <body>
        <div class="nombre">${producto.marca} ${producto.tipo}</div>
        <div class="detalles">
          ${bc.talle ? `Talle ${bc.talle}` : ""}
          ${bc.talle && bc.color ? " • " : ""}
          ${bc.color || ""}
        </div>
        <div class="barcode-container">
          <canvas id="barcode"></canvas>
        </div>
        <script>
          window.onload = function() {
            try {
              var codigoOriginal = "${bc.barcode}";
              var barcodeValue = codigoOriginal;
              var formato = "CODE128";

              // Función para sanitizar el código
              function sanitizarCodigo(codigo) {
                return codigo
                  .toUpperCase()
                  .replace(/Ñ/g, 'N')
                  .replace(/[ÁÀÂÄ]/g, 'A')
                  .replace(/[ÉÈÊË]/g, 'E')
                  .replace(/[ÍÌÎÏ]/g, 'I')
                  .replace(/[ÓÒÔÖ]/g, 'O')
                  .replace(/[ÚÙÛÜ]/g, 'U')
                  .replace(/[^A-Z0-9\-.$\/+% ]/g, '');
              }

              // Si contiene letras o guiones, usar CODE39
              if (/[A-Za-z-]/.test(barcodeValue)) {
                formato = "CODE39";
                barcodeValue = sanitizarCodigo(barcodeValue);
              }

              JsBarcode("#barcode", barcodeValue, {
                format: formato,
                width: formato === "CODE39" ? 2 : 2.5,
                height: 180,
                displayValue: false,
                fontSize: 22,
                margin: 4,
                background: "#ffffff",
                lineColor: "#000000"
              });

              // Agregar el código original debajo del barcode
              var canvas = document.getElementById('barcode');
              var ctx = canvas.getContext('2d');
              ctx.fillStyle = '#000';
              ctx.font = 'bold 22px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(codigoOriginal, canvas.width / 2, canvas.height - 8);

              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 500);
              }, 500);
            } catch(e) {
              alert("Error generando código: " + e.message);
            }
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(etiquetaHTML);
    printWindow.document.close();
  }

  if (!producto || !barcodes || barcodes.length === 0) {
    return (
      <div className="modalOverlay" onMouseDown={onClose}>
        <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
          <div className="modalHeader">
            <div className="modalTitle">Imprimir Etiquetas</div>
            <button className="modalClose" onClick={onClose}>✕</button>
          </div>
          <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)" }}>
            No hay códigos de barras para imprimir
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modalCard modalLarge" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">Imprimir Etiquetas - {producto.marca} {producto.tipo}</div>
          <button className="modalClose" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "16px 0" }}>
          <div style={{
            padding: "14px 24px",
            background: "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(37,99,235,0.12) 100%)",
            border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            color: "#1e40af",
            textAlign: "center",
            marginBottom: 20,
          }}>
            Hacé clic en <strong>Imprimir</strong> en cada etiqueta para imprimirla
          </div>

          <div className="labels-grid">
            {barcodes.map((bc) => (
              <div key={bc.id} className="label-preview">
                <div className="label-header">
                  <div className="label-info">
                    <div className="label-code">Código: {bc.barcode}</div>
                    {bc.talle && <div className="label-detail">Talle: {bc.talle}</div>}
                    {bc.color && <div className="label-detail">Color: {bc.color}</div>}
                    <div className="label-detail">Stock: {bc.cantidad}</div>
                  </div>
                </div>

                <div className="label-canvas">
                  <canvas ref={(el) => (canvasRefs.current[bc.id] = el)} />
                </div>

                <button
                  className="btn primary"
                  onClick={() => handlePrint(bc.id)}
                  style={{ width: "100%", marginTop: 12 }}
                >
                  Imprimir
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
