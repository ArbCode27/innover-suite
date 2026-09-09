import type { Producto } from "@/types/pedido";

const img = (seed: string) =>
  `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=900&q=80`;

export const PRODUCTOS_MOCK: Producto[] = [
  {
    id: "promo-001",
    nombre: "Combo Clásico",
    descripcion:
      "Hamburguesa doble con papas y la bebida que elijas. Ideal para compartir o para un almuerzo completo.",
    imagenUrl: img("photo-1550547660-d9450f859349"),
    precio: 12.9,
    categoria: "promociones",
    etiquetas: ["Promo", "Nuevo"],
    esPromo: true,
    ingredientesBase: [
      { id: "ing-cebolla", nombre: "Cebolla", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-pepinillos", nombre: "Pepinillos", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-lechuga", nombre: "Lechuga", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-queso", nombre: "Queso", esAlergeno: true, removible: true, incluidoPorDefecto: true },
    ],
    gruposModificadores: [
      {
        id: "grp-extras-combo",
        titulo: "Extras",
        tipo: "extras",
        obligatorio: false,
        seleccionMinima: 0,
        seleccionMaxima: 3,
        opciones: [
          { id: "ext-tocino", nombre: "Extra de tocino", precioAdicional: 2 },
          { id: "ext-guacamole", nombre: "Guacamole", precioAdicional: 1.5 },
          { id: "ext-huevo", nombre: "Huevo frito", precioAdicional: 1.2 },
        ],
      },
      {
        id: "grp-bebida-combo",
        titulo: "Elige tu bebida",
        tipo: "bebida",
        obligatorio: true,
        seleccionMinima: 1,
        seleccionMaxima: 1,
        opciones: [
          { id: "beb-coca", nombre: "Coca-Cola", precioAdicional: 0 },
          { id: "beb-coca-zero", nombre: "Coca-Cola Zero", precioAdicional: 0 },
          { id: "beb-agua", nombre: "Agua", precioAdicional: 0 },
          { id: "beb-cerveza", nombre: "Cerveza", precioAdicional: 1.5 },
        ],
      },
      {
        id: "grp-postre-combo",
        titulo: "Postre incluido",
        tipo: "postre",
        obligatorio: true,
        seleccionMinima: 1,
        seleccionMaxima: 1,
        opciones: [
          { id: "pos-flan", nombre: "Flan de caramelo", precioAdicional: 0 },
          { id: "pos-brownie", nombre: "Brownie", precioAdicional: 0.8 },
          { id: "pos-helado", nombre: "Helado de vainilla", precioAdicional: 0.5 },
        ],
      },
    ],
  },
  {
    id: "promo-002",
    nombre: "Menú Ejecutivo",
    descripcion:
      "Pollo a la plancha, arroz, ensalada y bebida. Personaliza extras y el postre del día.",
    imagenUrl: img("photo-1546069901-ba9599a7e63c"),
    precio: 14.5,
    categoria: "promociones",
    etiquetas: ["Promo"],
    esPromo: true,
    ingredientesBase: [
      { id: "ing-arroz", nombre: "Arroz", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-ensalada", nombre: "Ensalada", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-ajo", nombre: "Ajo", esAlergeno: false, removible: true, incluidoPorDefecto: true },
    ],
    gruposModificadores: [
      {
        id: "grp-adiciones-ej",
        titulo: "Adiciones",
        tipo: "adiciones",
        obligatorio: false,
        seleccionMinima: 0,
        seleccionMaxima: 2,
        opciones: [
          { id: "ad-papa", nombre: "Papas fritas", precioAdicional: 2.5 },
          { id: "ad-arepa", nombre: "Arepa queso", precioAdicional: 2 },
        ],
      },
      {
        id: "grp-bebida-ej",
        titulo: "Bebida",
        tipo: "bebida",
        obligatorio: true,
        seleccionMinima: 1,
        seleccionMaxima: 1,
        opciones: [
          { id: "beb-jugo", nombre: "Jugo natural", precioAdicional: 0 },
          { id: "beb-refresco", nombre: "Refresco", precioAdicional: 0 },
          { id: "beb-te", nombre: "Té frío", precioAdicional: 0 },
        ],
      },
      {
        id: "grp-postre-ej",
        titulo: "Postre",
        tipo: "postre",
        obligatorio: true,
        seleccionMinima: 1,
        seleccionMaxima: 1,
        opciones: [
          { id: "pos-fruta", nombre: "Ensalada de frutas", precioAdicional: 0 },
          { id: "pos-tresleches", nombre: "Tres leches", precioAdicional: 1 },
        ],
      },
    ],
  },
  {
    id: "plato-001",
    nombre: "Hamburguesa Doble",
    descripcion: "Dos carnes, queso cheddar y pan brioche. Puedes sumar una bebida opcional.",
    imagenUrl: img("photo-1568901346375-23c9450c58cd"),
    precio: 9.9,
    categoria: "platos_principales",
    etiquetas: ["Picante"],
    esPromo: false,
    ingredientesBase: [
      { id: "ing-cebolla-2", nombre: "Cebolla", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-pepinillos-2", nombre: "Pepinillos", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-salsa", nombre: "Salsa especial", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-jalapeno", nombre: "Jalapeño", esAlergeno: false, removible: true, incluidoPorDefecto: true },
    ],
    gruposModificadores: [
      {
        id: "grp-extras-burg",
        titulo: "Extras",
        tipo: "extras",
        obligatorio: false,
        seleccionMinima: 0,
        seleccionMaxima: 4,
        opciones: [
          { id: "ext-tocino-2", nombre: "Extra de tocino", precioAdicional: 2 },
          { id: "ext-queso", nombre: "Queso extra", precioAdicional: 1 },
          { id: "ext-champ", nombre: "Champiñones", precioAdicional: 1.5 },
        ],
      },
      {
        id: "grp-bebida-burg",
        titulo: "Agregar bebida (opcional)",
        tipo: "bebida",
        obligatorio: false,
        seleccionMinima: 0,
        seleccionMaxima: 1,
        opciones: [
          { id: "beb-coca-2", nombre: "Coca-Cola", precioAdicional: 2 },
          { id: "beb-agua-2", nombre: "Agua", precioAdicional: 1.5 },
          { id: "beb-limonada", nombre: "Limonada", precioAdicional: 2.2 },
        ],
      },
    ],
  },
  {
    id: "plato-002",
    nombre: "Pasta Alfredo",
    descripcion: "Fettuccine en salsa cremosa con pollo a la plancha.",
    imagenUrl: img("photo-1621996346565-e3dbc646d9a9"),
    precio: 11.5,
    categoria: "platos_principales",
    etiquetas: [],
    esPromo: false,
    ingredientesBase: [
      { id: "ing-pollo", nombre: "Pollo", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-perejil", nombre: "Perejil", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-parmesano", nombre: "Parmesano", esAlergeno: true, removible: true, incluidoPorDefecto: true },
    ],
    gruposModificadores: [
      {
        id: "grp-extras-pasta",
        titulo: "Extras",
        tipo: "extras",
        obligatorio: false,
        seleccionMinima: 0,
        seleccionMaxima: 2,
        opciones: [
          { id: "ext-camaron", nombre: "Camarones", precioAdicional: 3.5 },
          { id: "ext-bacon-pasta", nombre: "Tocino crocante", precioAdicional: 2 },
        ],
      },
    ],
  },
  {
    id: "plato-003",
    nombre: "Bowl Mediterráneo",
    descripcion: "Quinoa, vegetales asados, hummus y aderezo de limón.",
    imagenUrl: img("photo-1512621776951-a57141f2eefd"),
    precio: 10.2,
    categoria: "platos_principales",
    etiquetas: ["Nuevo"],
    esPromo: false,
    ingredientesBase: [
      { id: "ing-hummus", nombre: "Hummus", esAlergeno: true, removible: true, incluidoPorDefecto: true },
      { id: "ing-aceitunas", nombre: "Aceitunas", esAlergeno: false, removible: true, incluidoPorDefecto: true },
      { id: "ing-feta", nombre: "Queso feta", esAlergeno: true, removible: true, incluidoPorDefecto: true },
    ],
  },
  {
    id: "postre-001",
    nombre: "Cheesecake de frutos rojos",
    descripcion: "Base crocante, crema suave y coulis de frutos rojos.",
    imagenUrl: img("photo-1533134242443-d4fd215305ad"),
    precio: 5.9,
    categoria: "postres",
    etiquetas: [],
    esPromo: false,
  },
  {
    id: "postre-002",
    nombre: "Brownie con helado",
    descripcion: "Brownie caliente con bola de helado de vainilla.",
    imagenUrl: img("photo-1606313564200-e75d5e30476c"),
    precio: 6.4,
    categoria: "postres",
    etiquetas: ["Nuevo"],
    esPromo: false,
  },
  {
    id: "bebida-001",
    nombre: "Limonada de hierbabuena",
    descripcion: "Refrescante, natural y sin azúcar añadida.",
    imagenUrl: img("photo-1523677011786-c03bb72f3d48"),
    precio: 3.2,
    categoria: "bebidas",
    etiquetas: [],
    esPromo: false,
  },
];

export const getProductoById = (id: string) =>
  PRODUCTOS_MOCK.find((producto) => producto.id === id) ?? null;

export const getProductosPorCategoria = () => {
  const order = ["promociones", "platos_principales", "postres", "bebidas"] as const;
  return order
    .map((categoria) => ({
      categoria,
      productos: PRODUCTOS_MOCK.filter((producto) => producto.categoria === categoria),
    }))
    .filter((section) => section.productos.length > 0);
};
