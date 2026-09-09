import { NextResponse } from "next/server";
import { z } from "zod";

const ERROR_RATE = 0.15;

const payloadSchema = z.object({
  identificadorMesaOCliente: z.string().trim().min(1).max(80),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        nombre: z.string().min(1),
        cantidad: z.number().positive(),
        ingredientesRemovidos: z.array(z.string()),
        modificadores: z.array(
          z.object({
            grupo: z.string(),
            seleccion: z.string(),
            precioAdicional: z.number(),
          }),
        ),
        precioUnitarioFinal: z.number().nonnegative(),
        subtotalLinea: z.number().nonnegative(),
      }),
    )
    .min(1),
  subtotal: z.number().nonnegative(),
  impuestos: z.number().nonnegative(),
  cargoServicio: z.number().nonnegative(),
  total: z.number().nonnegative(),
  notasGenerales: z.string().optional(),
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const POST = async (request: Request) => {
  try {
    const json = await request.json();
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload de pedido inválido." }, { status: 400 });
    }

    await sleep(1200 + Math.floor(Math.random() * 800));

    if (Math.random() < ERROR_RATE) {
      return NextResponse.json(
        { error: "Cocina no respondió a tiempo. Puedes reintentar sin perder el carrito." },
        { status: 500 },
      );
    }

    const stamp = new Date();
    const numeroOrden = `ORD-${stamp.toISOString().slice(0, 10).replaceAll("-", "")}-${String(
      Math.floor(Math.random() * 900) + 100,
    )}`;

    return NextResponse.json(
      {
        numeroOrden,
        estado: "enviado_a_cocina",
        fechaCreacion: stamp.toISOString(),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "No se pudo procesar el pedido." }, { status: 500 });
  }
};
