"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { upsertContactAction } from "@/lib/contacts/actions";
import type { ContactListItem } from "@/lib/contacts/board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ContactsBoardProps = {
  contacts: ContactListItem[];
  initialQuery: string;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-VE", { dateStyle: "medium" }).format(new Date(value));

export const ContactsBoard = ({ contacts, initialQuery }: ContactsBoardProps) => {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "" });
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    const next = query.trim();
    router.push(next ? `/contacts?q=${encodeURIComponent(next)}` : "/contacts");
  };

  const handleCreate = () => {
    startTransition(async () => {
      const result = await upsertContactAction({
        fullName: form.fullName,
        phone: form.phone || undefined,
        email: form.email || undefined,
      });
      if (result.error) {
        toastActionError(result);
        return;
      }
      toast.success(result.success);
      setIsSheetOpen(false);
      setForm({ fullName: "", phone: "", email: "" });
      router.refresh();
    });
  };

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Directorio</CardTitle>
          <CardDescription>Busca por nombre, teléfono o correo.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex min-w-56 flex-1 gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSearch();
              }}
              placeholder="Buscar contacto"
              aria-label="Buscar contacto"
            />
            <Button type="button" variant="outline" onClick={handleSearch} aria-label="Buscar">
              <Search />
            </Button>
          </div>
          <Button type="button" onClick={() => setIsSheetOpen(true)}>
            <Plus />
            Nuevo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {contacts.length ? (
          <ul className="divide-y divide-primary/10">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="flex flex-col gap-1 rounded-xl px-2 py-3 transition hover:bg-primary/8 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium">{contact.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[contact.phone, contact.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {contact.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary">
                        {tag}
                      </span>
                    ))}
                    <span>{formatDate(contact.updatedAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-primary/20 p-6 text-sm text-muted-foreground">
            Aún no hay contactos. Entran solos con los mensajes de Meta, o créalos aquí.
          </p>
        )}
      </CardContent>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nuevo contacto</SheetTitle>
            <SheetDescription>Úsalo si el cliente aún no escribió por un canal conectado.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Nombre</Label>
              <Input
                id="contact-name"
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Teléfono</Label>
              <Input
                id="contact-phone"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Correo</Label>
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="button" onClick={handleCreate} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  );
};
