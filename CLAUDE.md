# KAIA Stock - Sistema de Gestión de Inventario

Aplicación Electron para gestionar stock y ventas de productos de óptica.

## Tecnologías

- **Frontend:** React + Vite
- **Backend:** Electron + Node.js
- **Base de datos:** SQLite (sql.js)
- **Impresión:** JsBarcode + CSS @page
- **Estilos:** CSS personalizado

## Estructura del Proyecto

```
StockNegocio/
├── main/                    # Proceso principal de Electron
│   ├── main.js             # Punto de entrada
│   ├── db.js               # Gestión de base de datos SQLite
│   ├── ipc.js              # Handlers IPC (comunicación con renderer)
│   └── preload.js          # Script de preload
├── renderer/               # Proceso renderer (UI)
│   ├── src/
│   │   ├── App.jsx         # Componente principal
│   │   ├── pages/          # Páginas de la aplicación
│   │   │   ├── StockPage.jsx      # Gestión de stock
│   │   │   ├── VentasPage.jsx     # Gestión de ventas
│   │   │   └── InstructivoPage.jsx # Guía de uso
│   │   └── components/     # Componentes reutilizables
│   │       ├── PrintLabel.jsx      # Impresión de etiquetas
│   │       └── ModalEscaneoBarcode.jsx
│   └── index.html
└── build/                  # Assets de compilación
    └── icon.png           # Icono de la aplicación
```

## Funcionalidades Principales

### 1. Gestión de Stock

#### Agregar Productos
- Selección de marca, tipo y modelo
- Definición de talles y colores disponibles
- Precio de costo y precio final

#### Códigos de Barras
**Dos modos de agregar códigos:**

1. **Escanear Código Existente**
   - Usar lectora de códigos de barras
   - Ingreso manual del código
   - Detección automática de duplicados

2. **Generar Código Automático**
   - Sistema secuencial (0000001, 0000002...)
   - Generación automática cuando el producto no tiene código
   - Flujo continuo para agregar múltiples códigos

**Flujo de agregado:**
1. Seleccionar producto
2. Hacer clic en "Generar Código Automático"
3. Seleccionar talle y color
4. Guardar
5. Opciones post-guardado:
   - Agregar Otro Código (continuar con el mismo producto)
   - Listo (terminar)
   - Volver al Menú

#### Inventario
- Vista completa de todos los productos
- Filtros por marca y tipo
- Búsqueda por código de barras
- Edición de productos (marca, tipo, modelo, precios)
- Gestión de códigos individuales (editar cantidad, eliminar)
- Eliminación de productos completos

### 2. Impresión de Etiquetas

**Especificaciones:**
- Tamaño: 70mm x 40mm
- Orientación: Horizontal (landscape)
- Impresora compatible: Xprinter XP-E200M (térmica USB)

**Contenido de la etiqueta:**
- Tipo de producto (sin marca)
- Modelo/Código
- Talle
- Color
- Código de barras CODE128

**Parámetros del código de barras:**
```javascript
{
  format: "CODE128",
  width: 2.5,      // Ancho de barras
  height: 180,     // Altura del código
  displayValue: true,
  fontSize: 22,
  margin: 4,       // Márgenes (quiet zones para escáner)
}
```

**Proceso de impresión:**
1. Abrir producto en inventario
2. Clic en "Imprimir Etiquetas"
3. Vista previa de todas las etiquetas disponibles
4. Imprimir individualmente cada etiqueta
5. Se abre ventana nueva con solo la etiqueta (sin UI de la app)

### 3. Gestión de Ventas

#### Crear Lote de Venta
- Escaneo de productos vendidos
- Modificación de precio de venta por producto
- Nombre del cliente (opcional)
- Método de pago: Efectivo, Débito, Crédito, Transferencia

#### Gestionar Lote Abierto
- Agregar productos escaneando códigos
- Quitar productos del lote
- Ver total acumulado
- Cancelar lote (devuelve stock)

#### Finalizar Venta
- Cerrar lote
- Descuento automático de stock
- Registro en historial

#### Historial de Ventas
- Lista de todos los lotes cerrados
- Detalle: fecha, hora, cliente, total, método de pago
- Ver productos vendidos en cada lote
- Eliminar lotes del historial

### 4. Temporadas

**Sistema de temporadas:**
- Invierno '26
- Verano '26

Cada temporada mantiene su propio stock y base de datos independiente.

### 5. Instructivo

Pestaña completa con guía de uso que cubre:
- Gestión de temporadas
- Agregar productos (escaneo y generación automática)
- Gestionar inventario
- Imprimir etiquetas
- Gestión de ventas
- Consejos y mejores prácticas
- Soporte técnico

## Base de Datos

### Tablas Principales

**Producto**
```sql
CREATE TABLE Producto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  marca TEXT NOT NULL,
  tipo TEXT NOT NULL,
  codigo TEXT,
  costo REAL,
  precioFinal REAL,
  tallesDisponibles TEXT,  -- JSON array
  coloresDisponibles TEXT, -- JSON array
  temporada TEXT
);
```

**ProductoBarcode**
```sql
CREATE TABLE ProductoBarcode (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productoId INTEGER NOT NULL,
  barcode TEXT UNIQUE NOT NULL,
  talle TEXT,
  color TEXT,
  cantidad INTEGER DEFAULT 1,
  FOREIGN KEY (productoId) REFERENCES Producto(id) ON DELETE CASCADE
);
```

**LoteVenta**
```sql
CREATE TABLE LoteVenta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente TEXT,
  metodoPago TEXT,
  cerrado INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  closedAt TEXT
);
```

**VentaItem**
```sql
CREATE TABLE VentaItem (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loteId INTEGER NOT NULL,
  barcodeId INTEGER NOT NULL,
  precioVenta REAL NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loteId) REFERENCES LoteVenta(id) ON DELETE CASCADE,
  FOREIGN KEY (barcodeId) REFERENCES ProductoBarcode(id)
);
```

## IPC Handlers (main/ipc.js)

### Productos
- `producto:create` - Crear producto
- `producto:listWithBarcodes` - Listar productos con códigos
- `producto:update` - Actualizar producto
- `producto:delete` - Eliminar producto

### Códigos de Barras
- `barcode:getByCode` - Buscar por código
- `barcode:addOrIncrement` - Agregar o incrementar cantidad
  - **Auto-generación:** Si no se proporciona código, genera uno secuencial
- `barcode:listByProducto` - Listar códigos de un producto
- `barcode:update` - Actualizar código
- `barcode:updateCantidad` - Actualizar solo cantidad
- `barcode:delete` - Eliminar código

### Ventas
- `lote:create` - Crear lote nuevo
- `lote:getAbierto` - Obtener lote abierto
- `lote:addVenta` - Agregar producto al lote
- `lote:removeVenta` - Quitar producto del lote
- `lote:updateCliente` - Actualizar cliente
- `lote:updateMetodoPago` - Actualizar método de pago
- `lote:close` - Cerrar lote (descuenta stock)
- `lote:delete` - Eliminar lote
- `lote:list` - Listar todos los lotes

## Configuración de Compilación

**package.json - electron-builder:**
```json
{
  "build": {
    "appId": "com.kaia.stocknegocio",
    "productName": "KAIA Stock",
    "win": {
      "icon": "build/icon.png",
      "target": ["nsis"]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

## Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Inicia app en modo desarrollo

# Compilación
npm run dist             # Genera instalador Windows (.exe)
```

## Configuración de Impresora

**Impresora recomendada:** Xprinter XP-E200M
- Conexión: USB
- Tipo: Térmica
- Tamaño de papel: Rollos de 70mm x 40mm

**Configuración en Windows:**
1. Instalar driver de la impresora
2. Configurar tamaño de papel personalizado: 70mm x 40mm
3. La aplicación usa `window.print()` con CSS `@page`

## Características de Diseño

### UI/UX
- Diseño limpio y moderno
- Sin emojis en la interfaz
- Botones con gradientes
- Sombras suaves
- Transiciones fluidas
- Responsive para diferentes tamaños de ventana

### Colores
- Primario: Azul (#3b82f6, #2563eb)
- Secundario: Verde (#10b981, #059669)
- Texto: Grises (#1f2937, #64748b)
- Fondos: Blancos con gradientes suaves

### Tipografía
- Font principal: 'Plus Jakarta Sans'
- Fallback: 'Inter', -apple-system, sans-serif
- Weights: 600, 700, 900

## Flujos de Trabajo Principales

### Agregar Producto con Código Automático
```
1. Clic en "Agregar Invierno '26" o "Agregar Verano '26"
2. Completar: Marca, Tipo, Modelo, Precios
3. Definir talles y colores disponibles
4. Clic en "Agregar Stock"
5. Clic en "Generar Código Automático"
6. Seleccionar talle y color
7. Indicar cantidad
8. Clic en "Guardar Código"
9. Elegir: "Agregar Otro Código" o "Listo"
```

### Imprimir Etiquetas
```
1. Ir a "Inventario"
2. Buscar producto
3. Clic en "Imprimir Etiquetas"
4. Vista previa de todas las etiquetas
5. Clic en "Imprimir" en cada etiqueta individual
6. Se abre ventana nueva
7. Diálogo de impresión del sistema
8. Seleccionar impresora térmica
9. Imprimir
```

### Realizar Venta
```
1. Clic en "Ventas"
2. Clic en "Nuevo Lote"
3. Escanear productos vendidos
4. Ajustar precios si es necesario
5. Ingresar nombre del cliente
6. Seleccionar método de pago
7. Clic en "Cerrar Lote"
8. Stock se descuenta automáticamente
```

## Mantenimiento

### Base de Datos
- Ubicación: `%APPDATA%/stocknegocio/stock.db`
- Backup recomendado: Copiar archivo .db periódicamente
- No usar `asar: true` (facilita acceso a DB)

### Logs
- Ubicación: Consola de DevTools en desarrollo
- Errores se muestran con `console.error`

## Resolución de Problemas

### Etiquetas no se imprimen correctamente
- Verificar tamaño de papel: 70mm x 40mm
- Verificar orientación: Horizontal (landscape)
- Verificar driver de impresora instalado
- Probar con Chrome print preview

### Código de barras no se lee
- Verificar quiet zones (márgenes) = 4mm mínimo
- Verificar altura mínima = 180px
- Verificar ancho de barras = 2.5px mínimo
- Limpiar lente del escáner

### Base de datos corrupta
- Restaurar desde backup
- O crear nueva base de datos (opción al iniciar)

## Próximas Mejoras Sugeridas

- [ ] Exportar inventario a Excel/CSV
- [ ] Reportes de ventas por período
- [ ] Gráficos de ventas
- [ ] Multi-usuario con roles
- [ ] Sincronización en la nube
- [ ] Backup automático
- [ ] Impresión por lote (múltiples etiquetas)
- [ ] Código de barras QR como alternativa
- [ ] Sistema de alertas de stock bajo
- [ ] Integración con sistemas de facturación

## Contacto y Soporte

Para soporte técnico o reportar bugs, contactar al equipo de desarrollo.

---

**Versión actual:** 1.0.2  
**Última actualización:** Mayo 2026
