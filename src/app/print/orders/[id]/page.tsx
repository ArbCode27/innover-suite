import { notFound, redirect } from "next/navigation";
import { loadOrderById } from "@/lib/commerce/orders";
import { formatMoney } from "@/lib/commerce/types";
import { canManageOrders, getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PrintPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderPrintPage({ params }: PrintPageProps) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (!canManageOrders(membership)) redirect("/home");

  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId)) notFound();

  const supabase = await createSupabaseServerClient();
  const order = await loadOrderById(supabase, membership.organizationId, orderId);
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-sm bg-white p-6 font-sans text-sm text-black print:p-0">
      <h1 className="text-center text-lg font-bold">{membership.organizationName}</h1>
      <p className="mt-1 text-center">Ticket #{order.id}</p>
      <p className="mt-1 text-center text-xs">
        {new Intl.DateTimeFormat("es-DO", { dateStyle: "short", timeStyle: "short" }).format(new Date(order.createdAt))}
      </p>
      <p className="mt-3">{order.contactName}</p>
      {order.deliveryAddress ? <p className="text-xs">Entrega: {order.deliveryAddress}</p> : null}
      <ul className="mt-4 border-y border-black py-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-2">
            <span>
              {item.quantity}× {item.name}
            </span>
            <span>{formatMoney(item.unitPrice * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between">
        <span>Subtotal</span>
        <span>{formatMoney(order.subtotal)}</span>
      </p>
      {order.discountAmount ? (
        <p className="flex justify-between">
          <span>Descuento</span>
          <span>-{formatMoney(order.discountAmount)}</span>
        </p>
      ) : null}
      <p className="flex justify-between">
        <span>ITBIS</span>
        <span>{formatMoney(order.taxAmount)}</span>
      </p>
      {order.deliveryFee ? (
        <p className="flex justify-between">
          <span>Envío</span>
          <span>{formatMoney(order.deliveryFee)}</span>
        </p>
      ) : null}
      <p className="mt-2 flex justify-between text-base font-bold">
        <span>Total</span>
        <span>{formatMoney(order.total)}</span>
      </p>
      <p className="mt-4 text-center text-xs">Pago: {order.paymentStatus}</p>
      <script
        dangerouslySetInnerHTML={{
          __html: "window.addEventListener('load', function () { window.print(); });",
        }}
      />
    </main>
  );
}
