export type Ingrediente = {
  id: string;
  nombre: string;
  esAlergeno: boolean;
  removible: boolean;
  incluidoPorDefecto: boolean;
};

export type OpcionModificador = {
  id: string;
  nombre: string;
  precioAdicional: number;
};

export type GrupoModificador = {
  id: string;
  titulo: string;
  tipo: "extras" | "adiciones" | "bebida" | "postre";
  obligatorio: boolean;
  seleccionMinima: number;
  seleccionMaxima: number;
  opciones: OpcionModificador[];
};

export type ProductoCategoria =
  | "promociones"
  | "platos_principales"
  | "postres"
  | "bebidas";

export type Producto = {
  id: string;
  nombre: string;
  descripcion: string;
  imagenUrl: string;
  precio: number;
  categoria: ProductoCategoria;
  etiquetas: string[];
  esPromo: boolean;
  ingredientesBase?: Ingrediente[];
  gruposModificadores?: GrupoModificador[];
};

export type SeleccionModificador = {
  grupoId: string;
  opcionesSeleccionadas: OpcionModificador[];
};

export type ItemCarrito = {
  id: string;
  producto: Producto;
  cantidad: number;
  ingredientesRemovidos: string[];
  modificadoresSeleccionados: SeleccionModificador[];
  precioUnitarioFinal: number;
  subtotalLinea: number;
};

export type Pedido = {
  identificadorMesaOCliente: string;
  items: ItemCarrito[];
  subtotal: number;
  impuestos: number;
  cargoServicio: number;
  total: number;
  notasGenerales?: string;
};

export type PedidoApiItem = {
  productoId: string;
  nombre: string;
  cantidad: number;
  ingredientesRemovidos: string[];
  modificadores: Array<{
    grupo: string;
    seleccion: string;
    precioAdicional: number;
  }>;
  precioUnitarioFinal: number;
  subtotalLinea: number;
};

export type PedidoApiPayload = {
  identificadorMesaOCliente: string;
  items: PedidoApiItem[];
  subtotal: number;
  impuestos: number;
  cargoServicio: number;
  total: number;
  notasGenerales?: string;
};

export type PedidoApiResponse = {
  numeroOrden: string;
  estado: string;
  fechaCreacion: string;
};

export const IMPUESTO_TASA = 0.16;
export const CARGO_SERVICIO_DEFAULT = 0;

export const formatPrecio = (value: number, currency = "USD") =>
  new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export const calcularPrecioUnitario = (
  producto: Producto,
  modificadores: SeleccionModificador[],
) => {
  const extras = modificadores.reduce(
    (sum, grupo) =>
      sum +
      grupo.opcionesSeleccionadas.reduce((inner, opcion) => inner + opcion.precioAdicional, 0),
    0,
  );
  return Math.round((producto.precio + extras) * 100) / 100;
};

export const validarGruposObligatorios = (
  producto: Producto,
  modificadores: SeleccionModificador[],
) => {
  const grupos = producto.gruposModificadores ?? [];
  for (const grupo of grupos) {
    if (!grupo.obligatorio) continue;
    const seleccion =
      modificadores.find((entry) => entry.grupoId === grupo.id)?.opcionesSeleccionadas ?? [];
    if (seleccion.length < grupo.seleccionMinima) {
      return `Selecciona al menos ${grupo.seleccionMinima} en “${grupo.titulo}”`;
    }
  }
  return null;
};

export const CATEGORIA_LABELS: Record<ProductoCategoria, string> = {
  promociones: "Promociones destacadas",
  platos_principales: "Platos principales",
  postres: "Postres",
  bebidas: "Bebidas",
};
