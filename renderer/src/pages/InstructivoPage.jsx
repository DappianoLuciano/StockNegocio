export default function InstructivoPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{
        marginBottom: 32,
        paddingBottom: 20,
        borderBottom: "2px solid var(--border)"
      }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 900,
          marginBottom: 8,
          color: "var(--text)"
        }}>
          Instructivo de Uso
        </h1>
        <p style={{
          fontSize: 15,
          color: "var(--muted)",
          fontWeight: 700
        }}>
          Guía completa para gestionar el stock y ventas de tu negocio
        </p>
      </div>

      {/* Sección 1: Gestión de Temporadas */}
      <Section title="1. Gestión de Temporadas">
        <p>La aplicación te permite gestionar productos por temporada:</p>
        <List>
          <li><strong>Invierno '26:</strong> Para productos de temporada invierno</li>
          <li><strong>Verano '26:</strong> Para productos de temporada verano</li>
        </List>
        <Note>
          Al hacer clic en una temporada, accedés a la pantalla para agregar productos específicos de esa temporada.
        </Note>
      </Section>

      {/* Sección 2: Agregar Productos */}
      <Section title="2. Agregar Productos al Stock">
        <Subsection title="Paso 1: Seleccionar Producto">
          <p>En la pantalla principal de cada temporada:</p>
          <List>
            <li>Seleccioná la <strong>Marca</strong> del producto (ej: Karina Lang, Perramus)</li>
            <li>Seleccioná el <strong>Tipo</strong> de producto (ej: Remera, Abrigo, Campera)</li>
            <li>Ingresá el <strong>Modelo/Código</strong> del producto (ej: LOGO W, ABRIGO X)</li>
            <li>Opcionalmente ingresá el <strong>Costo</strong> y <strong>Precio Final</strong></li>
            <li>Agregá los <strong>Talles</strong> y <strong>Colores</strong> disponibles si corresponde</li>
          </List>
        </Subsection>

        <Subsection title="Paso 2: Agregar Códigos de Barras">
          <p>Una vez seleccionado el producto, hacé clic en <strong>"Agregar Stock"</strong>. Tenés dos opciones:</p>

          <OptionBox color="#3b82f6">
            <h4>Opción A: Escanear Código Existente</h4>
            <List>
              <li>Hacé clic en <strong>"Escanear Código de Barras"</strong></li>
              <li>Escaneá el código con la lectora o ingresalo manualmente</li>
              <li>Seleccioná el talle y color correspondiente</li>
              <li>Indicá la cantidad de unidades</li>
              <li>Hacé clic en <strong>"Guardar Código"</strong></li>
            </List>
          </OptionBox>

          <OptionBox color="#10b981">
            <h4>Opción B: Generar Código Automático</h4>
            <List>
              <li>Hacé clic en <strong>"Generar Código Automático"</strong></li>
              <li>El sistema generará automáticamente un código secuencial (0000001, 0000002...)</li>
              <li>Seleccioná el talle y color del producto</li>
              <li>Indicá la cantidad de unidades</li>
              <li>Hacé clic en <strong>"Guardar Código"</strong></li>
            </List>
            <Note>
              Después de guardar, podés elegir agregar más códigos al mismo producto o terminar.
            </Note>
          </OptionBox>
        </Subsection>

        <Subsection title="Códigos Duplicados">
          <p>Si escaneás un código que ya existe:</p>
          <List>
            <li>El sistema detecta automáticamente el código duplicado</li>
            <li>Te muestra el producto y stock actual</li>
            <li>Podés incrementar el stock en +1 unidad</li>
          </List>
        </Subsection>
      </Section>

      {/* Sección 3: Gestionar Inventario */}
      <Section title="3. Gestionar Inventario">
        <p>Hacé clic en <strong>"Inventario"</strong> en el menú lateral para ver todos tus productos:</p>

        <Subsection title="Ver y Buscar Productos">
          <List>
            <li><strong>Buscar por código:</strong> Hacé clic en el botón de búsqueda y escaneá o ingresá un código</li>
            <li><strong>Filtrar:</strong> Usá los filtros de Marca y Tipo para encontrar productos específicos</li>
            <li><strong>Ver detalles:</strong> Cada producto muestra su stock total y todos sus códigos</li>
          </List>
        </Subsection>

        <Subsection title="Editar Productos">
          <List>
            <li>Hacé clic en el botón de editar (lápiz) de cualquier producto</li>
            <li>Modificá marca, tipo, modelo, costo o precio final</li>
            <li>Agregá o eliminá talles y colores disponibles</li>
            <li>Guardá los cambios</li>
          </List>
        </Subsection>

        <Subsection title="Gestionar Códigos Individuales">
          <p>Dentro de cada producto podés:</p>
          <List>
            <li><strong>Ver cantidad:</strong> Cada código muestra su talle, color y cantidad en stock</li>
            <li><strong>Editar cantidad:</strong> Hacé clic en el botón de editar para modificar la cantidad</li>
            <li><strong>Eliminar código:</strong> Hacé clic en eliminar para quitar un código específico</li>
          </List>
        </Subsection>

        <Subsection title="Imprimir Etiquetas">
          <List>
            <li>Hacé clic en <strong>"Imprimir Etiquetas"</strong> en cualquier producto</li>
            <li>Se mostrarán todas las etiquetas disponibles con vista previa</li>
            <li>Cada etiqueta muestra: Tipo, Modelo, Talle, Color y Código de barras</li>
            <li>Hacé clic en el botón de <strong>"Imprimir"</strong> individual en cada etiqueta</li>
            <li>La etiqueta se imprimirá en formato 70x40mm (compatible con impresora térmica)</li>
          </List>
          <Note>
            Asegurate de tener configurada tu impresora térmica Xprinter XP-E200M antes de imprimir.
          </Note>
        </Subsection>

        <Subsection title="Eliminar Productos">
          <List>
            <li>Hacé clic en el botón de eliminar (tacho de basura) en cualquier producto</li>
            <li>Confirmá la eliminación</li>
            <li>El producto y todos sus códigos se eliminarán permanentemente</li>
          </List>
          <Warning>
            Esta acción no se puede deshacer. Asegurate antes de eliminar.
          </Warning>
        </Subsection>
      </Section>

      {/* Sección 4: Gestión de Ventas */}
      <Section title="4. Gestión de Ventas">
        <p>Hacé clic en <strong>"Ventas"</strong> en el menú lateral para gestionar tus ventas:</p>

        <Subsection title="Crear un Lote de Venta">
          <List>
            <li>Hacé clic en <strong>"Nuevo Lote"</strong></li>
            <li>Escaneá o ingresá los códigos de barras de los productos vendidos</li>
            <li>Cada producto escaneado se agregará al lote</li>
            <li>Podés modificar el precio de venta de cada producto individualmente</li>
            <li>Ingresá el nombre del <strong>Cliente</strong> (opcional)</li>
            <li>Seleccioná el <strong>Método de Pago</strong> (Efectivo, Débito, Crédito, Transferencia)</li>
          </List>
        </Subsection>

        <Subsection title="Gestionar el Lote">
          <p>Mientras tenés un lote abierto:</p>
          <List>
            <li><strong>Agregar productos:</strong> Seguí escaneando códigos para agregar más productos</li>
            <li><strong>Quitar productos:</strong> Hacé clic en eliminar al lado de cualquier producto</li>
            <li><strong>Ver total:</strong> El lote muestra el total acumulado de la venta</li>
            <li><strong>Cancelar lote:</strong> Podés cancelar y todos los productos vuelven al stock</li>
          </List>
        </Subsection>

        <Subsection title="Finalizar Venta">
          <List>
            <li>Verificá que todos los productos sean correctos</li>
            <li>Confirmá el cliente y método de pago</li>
            <li>Hacé clic en <strong>"Cerrar Lote"</strong></li>
            <li>Los productos se descontarán automáticamente del stock</li>
            <li>La venta quedará registrada en el historial</li>
          </List>
        </Subsection>

        <Subsection title="Ver Historial de Ventas">
          <List>
            <li>En la pestaña de Ventas, podés ver todos los lotes cerrados</li>
            <li>Cada lote muestra: fecha, hora, cliente, total y método de pago</li>
            <li>Hacé clic en un lote para ver el detalle completo de productos vendidos</li>
            <li>Podés eliminar lotes del historial si es necesario</li>
          </List>
        </Subsection>
      </Section>

      {/* Sección 5: Consejos y Mejores Prácticas */}
      <Section title="5. Consejos y Mejores Prácticas">
        <List>
          <li><strong>Códigos de barras:</strong> Si el producto ya viene con código, escanealo. Si no, generá uno automático.</li>
          <li><strong>Etiquetas:</strong> Imprimí etiquetas apenas agregás productos nuevos para facilitar la gestión.</li>
          <li><strong>Inventario:</strong> Revisá periódicamente el inventario para detectar productos con stock bajo.</li>
          <li><strong>Ventas:</strong> Cerrá los lotes apenas se finaliza la transacción para mantener el stock actualizado.</li>
          <li><strong>Respaldo:</strong> Los datos se guardan localmente en tu computadora, considerá hacer respaldos periódicos.</li>
        </List>
      </Section>

      {/* Sección 6: Soporte */}
      <Section title="6. Soporte Técnico">
        <p>Si encontrás algún problema o necesitás ayuda:</p>
        <List>
          <li>Revisá este instructivo primero</li>
          <li>Verificá que tu lectora de códigos de barras esté conectada correctamente</li>
          <li>Asegurate de tener la impresora térmica configurada antes de imprimir etiquetas</li>
          <li>Si el problema persiste, contactá al soporte técnico</li>
        </List>
      </Section>

      <div style={{
        marginTop: 48,
        padding: 24,
        background: "linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.1) 100%)",
        borderRadius: 16,
        border: "2px solid rgba(59,130,246,0.2)",
        textAlign: "center"
      }}>
        <p style={{ fontSize: 15, fontWeight: 900, color: "var(--text)", marginBottom: 8 }}>
          ¡Todo listo para empezar!
        </p>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)" }}>
          Ahora podés gestionar tu stock y ventas de forma eficiente
        </p>
      </div>
    </div>
  );
}

// Componentes auxiliares para el instructivo
function Section({ title, children }) {
  return (
    <div style={{
      marginBottom: 40,
      padding: 24,
      background: "white",
      borderRadius: 16,
      border: "2px solid var(--border)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
    }}>
      <h2 style={{
        fontSize: 24,
        fontWeight: 900,
        marginBottom: 16,
        color: "var(--text)",
        paddingBottom: 12,
        borderBottom: "2px solid var(--border)"
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Subsection({ title, children }) {
  return (
    <div style={{ marginTop: 24, marginBottom: 20 }}>
      <h3 style={{
        fontSize: 17,
        fontWeight: 900,
        marginBottom: 12,
        color: "var(--text)"
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function List({ children }) {
  return (
    <ul style={{
      marginLeft: 20,
      marginTop: 12,
      lineHeight: 1.8
    }}>
      {children}
    </ul>
  );
}

function Note({ children }) {
  return (
    <div style={{
      marginTop: 16,
      padding: 12,
      background: "rgba(59,130,246,0.08)",
      borderLeft: "4px solid #3b82f6",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 700,
      color: "var(--text)"
    }}>
      <strong style={{ color: "#3b82f6" }}>Nota:</strong> {children}
    </div>
  );
}

function Warning({ children }) {
  return (
    <div style={{
      marginTop: 16,
      padding: 12,
      background: "rgba(239,68,68,0.08)",
      borderLeft: "4px solid #ef4444",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 700,
      color: "var(--text)"
    }}>
      <strong style={{ color: "#ef4444" }}>Importante:</strong> {children}
    </div>
  );
}

function OptionBox({ color, children }) {
  return (
    <div style={{
      marginTop: 16,
      marginBottom: 16,
      padding: 16,
      background: `${color}08`,
      border: `2px solid ${color}30`,
      borderRadius: 12
    }}>
      {children}
    </div>
  );
}
