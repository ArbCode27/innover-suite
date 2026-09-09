import type { Pedido, PedidoApiPayload, PedidoApiResponse } from "@/types/pedido";

export class PedidoRequestError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "PedidoRequestError";
    this.status = status;
  }
}

const toApiPayload = (pedido: Pedido): PedidoApiPayload => ({
  identificadorMesaOCliente: pedido.identificadorMesaOCliente,
  items: pedido.items.map((item) => ({
    productoId: item.producto.id,
    nombre: item.producto.nombre,
    cantidad: item.cantidad,
    ingredientesRemovidos: item.ingredientesRemovidos,
    modificadores: item.modificadoresSeleccionados.flatMap((grupo) => {
      const grupoMeta = item.producto.gruposModificadores?.find((entry) => entry.id === grupo.grupoId);
      return grupo.opcionesSeleccionadas.map((opcion) => ({
        grupo: grupoMeta?.tipo ?? grupo.grupoId,
        seleccion: opcion.nombre,
        precioAdicional: opcion.precioAdicional,
      }));
    }),
    precioUnitarioFinal: item.precioUnitarioFinal,
    subtotalLinea: item.subtotalLinea,
  })),
  subtotal: pedido.subtotal,
  impuestos: pedido.impuestos,
  cargoServicio: pedido.cargoServicio,
  total: pedido.total,
  notasGenerales: pedido.notasGenerales,
});

export const enviarPedidoApi = async (pedido: Pedido): Promise<PedidoApiResponse> => {
  const response = await fetch("/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toApiPayload(pedido)),
  });

  if (!response.ok) {
    let message = "No se pudo enviar el pedido. Inténtalo de nuevo.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new PedidoRequestError(message, response.status);
  }

  return (await response.json()) as PedidoApiResponse;
};
