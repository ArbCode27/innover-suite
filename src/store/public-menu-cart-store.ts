"use client";

import { create } from "zustand";
import type { SelfOrderCartLine, SelfOrderModifierSelection } from "@/lib/menu/self-order";
import { buildLineKey, buildLineNote, calcUnitPrice } from "@/lib/menu/self-order";

type Totals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

type AgregarInput = {
  menuItemId: number;
  name: string;
  basePrice: number;
  currency: string;
  imageUrl: string | null;
  quantity: number;
  removedIngredientIds: string[];
  removedIngredientNames: string[];
  modifiers: SelfOrderModifierSelection[];
};

type PublicMenuCartStore = {
  slug: string | null;
  customerName: string;
  items: SelfOrderCartLine[];
  isSubmitting: boolean;
  lastOrderId: number | null;
  ensureSlug: (slug: string) => void;
  setCustomerName: (value: string) => void;
  agregarItem: (input: AgregarInput) => SelfOrderCartLine;
  actualizarCantidad: (key: string, quantity: number) => void;
  eliminarItem: (key: string) => void;
  limpiarCarrito: () => void;
  getCantidadItems: () => number;
  getTotales: (promoPercent: number, taxRate: number) => Totals;
  setSubmitting: (value: boolean) => void;
  setLastOrderId: (orderId: number | null) => void;
};

const buildId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const usePublicMenuCartStore = create<PublicMenuCartStore>((set, get) => ({
  slug: null,
  customerName: "",
  items: [],
  isSubmitting: false,
  lastOrderId: null,

  ensureSlug: (slug) => {
    const current = get().slug;
    if (current && current !== slug) {
      set({
        slug,
        items: [],
        customerName: "",
        lastOrderId: null,
        isSubmitting: false,
      });
      return;
    }
    if (!current) set({ slug });
  },

  setCustomerName: (value) => set({ customerName: value }),

  agregarItem: (input) => {
    const quantity = Math.max(1, input.quantity);
    const unitPrice = calcUnitPrice(input.basePrice, input.modifiers);
    const key = buildLineKey(
      input.menuItemId,
      input.removedIngredientIds,
      input.modifiers,
    );
    const note = buildLineNote({
      removedNames: input.removedIngredientNames,
      modifiers: input.modifiers,
    });

    const existing = get().items.find((line) => line.key === key);
    if (existing) {
      set((state) => ({
        items: state.items.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + quantity } : line,
        ),
      }));
      return { ...existing, quantity: existing.quantity + quantity };
    }

    const line: SelfOrderCartLine = {
      key: key || buildId(),
      menuItemId: input.menuItemId,
      name: input.name,
      basePrice: input.basePrice,
      unitPrice,
      currency: input.currency,
      quantity,
      imageUrl: input.imageUrl,
      removedIngredientIds: input.removedIngredientIds,
      removedIngredientNames: input.removedIngredientNames,
      modifiers: input.modifiers,
      note,
    };
    set((state) => ({ items: [...state.items, line] }));
    return line;
  },

  actualizarCantidad: (key, quantity) => {
    const next = Math.max(1, quantity);
    set((state) => ({
      items: state.items.map((line) => (line.key === key ? { ...line, quantity: next } : line)),
    }));
  },

  eliminarItem: (key) => {
    set((state) => ({ items: state.items.filter((line) => line.key !== key) }));
  },

  limpiarCarrito: () => set({ items: [], lastOrderId: null }),

  getCantidadItems: () => get().items.reduce((sum, line) => sum + line.quantity, 0),

  getTotales: (promoPercent, taxRate) => {
    const subtotal =
      Math.round(get().items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) * 100) /
      100;
    const discount =
      promoPercent > 0 ? Math.round(subtotal * (promoPercent / 100) * 100) / 100 : 0;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * taxRate * 100) / 100;
    const total = Math.round((taxable + tax) * 100) / 100;
    return { subtotal, discount, tax, total };
  },

  setSubmitting: (value) => set({ isSubmitting: value }),
  setLastOrderId: (orderId) => set({ lastOrderId: orderId }),
}));
