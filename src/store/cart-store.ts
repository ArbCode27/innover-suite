"use client";

import { create } from "zustand";
import {
  CARGO_SERVICIO_DEFAULT,
  IMPUESTO_TASA,
  calcularPrecioUnitario,
  type ItemCarrito,
  type Pedido,
  type PedidoApiResponse,
  type Producto,
  type SeleccionModificador,
} from "@/types/pedido";
import { enviarPedidoApi } from "@/lib/pedidos-service";

type AgregarItemInput = {
  producto: Producto;
  cantidad: number;
  ingredientesRemovidos: string[];
  modificadoresSeleccionados: SeleccionModificador[];
};

type CartStore = {
  items: ItemCarrito[];
  identificadorMesaOCliente: string;
  notasGenerales: string;
  isSubmitting: boolean;
  lastOrder: PedidoApiResponse | null;
  setIdentificador: (value: string) => void;
  setNotasGenerales: (value: string) => void;
  agregarItem: (input: AgregarItemInput) => ItemCarrito;
  actualizarCantidad: (itemId: string, cantidad: number) => void;
  eliminarItem: (itemId: string) => void;
  limpiarCarrito: () => void;
  getTotales: () => Pick<Pedido, "subtotal" | "impuestos" | "cargoServicio" | "total">;
  getCantidadItems: () => number;
  enviarPedido: () => Promise<PedidoApiResponse>;
};

const buildLineId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  identificadorMesaOCliente: "mesa-12",
  notasGenerales: "",
  isSubmitting: false,
  lastOrder: null,

  setIdentificador: (value) => set({ identificadorMesaOCliente: value }),
  setNotasGenerales: (value) => set({ notasGenerales: value }),

  agregarItem: ({ producto, cantidad, ingredientesRemovidos, modificadoresSeleccionados }) => {
    const safeCantidad = Math.max(1, cantidad);
    const precioUnitarioFinal = calcularPrecioUnitario(producto, modificadoresSeleccionados);
    const item: ItemCarrito = {
      id: buildLineId(),
      producto,
      cantidad: safeCantidad,
      ingredientesRemovidos,
      modificadoresSeleccionados,
      precioUnitarioFinal,
      subtotalLinea: Math.round(precioUnitarioFinal * safeCantidad * 100) / 100,
    };
    set((state) => ({ items: [...state.items, item] }));
    return item;
  },

  actualizarCantidad: (itemId, cantidad) => {
    const next = Math.max(1, cantidad);
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              cantidad: next,
              subtotalLinea: Math.round(item.precioUnitarioFinal * next * 100) / 100,
            }
          : item,
      ),
    }));
  },

  eliminarItem: (itemId) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== itemId) }));
  },

  limpiarCarrito: () => set({ items: [], notasGenerales: "", lastOrder: null }),

  getTotales: () => {
    const subtotal = Math.round(get().items.reduce((sum, item) => sum + item.subtotalLinea, 0) * 100) / 100;
    const impuestos = Math.round(subtotal * IMPUESTO_TASA * 100) / 100;
    const cargoServicio = CARGO_SERVICIO_DEFAULT;
    const total = Math.round((subtotal + impuestos + cargoServicio) * 100) / 100;
    return { subtotal, impuestos, cargoServicio, total };
  },

  getCantidadItems: () => get().items.reduce((sum, item) => sum + item.cantidad, 0),

  enviarPedido: async () => {
    const state = get();
    if (!state.items.length) {
      throw new Error("El carrito está vacío.");
    }
    if (state.isSubmitting) {
      throw new Error("El pedido ya se está enviando.");
    }

    set({ isSubmitting: true });
    try {
      const totales = state.getTotales();
      const pedido: Pedido = {
        identificadorMesaOCliente: state.identificadorMesaOCliente,
        items: state.items,
        ...totales,
        notasGenerales: state.notasGenerales || undefined,
      };
      const response = await enviarPedidoApi(pedido);
      set({ lastOrder: response, items: [], notasGenerales: "" });
      return response;
    } finally {
      set({ isSubmitting: false });
    }
  },
}));
