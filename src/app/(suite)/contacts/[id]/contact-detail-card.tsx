"use client";

import { useState, useTransition } from "react";
import { Loader2, StickyNote, Tag } from "lucide-react";
import { toast } from "sonner";
import { addContactNoteAction, addContactTagAction } from "@/lib/contacts/actions";
import type { ContactDetail } from "@/lib/contacts/board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContactDetailCardProps = {
  contact: ContactDetail;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export const ContactDetailCard = ({ contact }: ContactDetailCardProps) => {
  const [tagName, setTagName] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [visibleToAgent, setVisibleToAgent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleAddTag = () => {
    startTransition(async () => {
      const result = await addContactTagAction({ contactId: contact.id, name: tagName });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setTagName("");
    });
  };

  const handleAddNote = () => {
    startTransition(async () => {
      const result = await addContactNoteAction({
        contactId: contact.id,
        body: noteBody,
        visibleToAgent,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setNoteBody("");
      setVisibleToAgent(false);
    });
  };

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader>
        <CardTitle>Ficha</CardTitle>
        <CardDescription>Etiquetas y notas internas. Las notas visibles se inyectan al agente IA.</CardDescription>
        <div className="flex flex-wrap gap-2">
          {contact.tags.length ? (
            contact.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sin etiquetas.</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-2">
          <Input
            value={tagName}
            onChange={(event) => setTagName(event.target.value)}
            placeholder="Nueva etiqueta"
            aria-label="Nueva etiqueta"
          />
          <Button type="button" variant="outline" onClick={handleAddTag} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Tag />}
            Etiqueta
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-note">Nota interna</Label>
          <textarea
            id="contact-note"
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
            rows={4}
            className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={visibleToAgent} onCheckedChange={(value) => setVisibleToAgent(value === true)} />
            Visible para el agente IA
          </label>
          <Button type="button" onClick={handleAddNote} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <StickyNote />}
            Guardar nota
          </Button>
        </div>

        <ul className="space-y-3">
          {contact.notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-primary/10 bg-background/70 p-3 text-sm">
              <p>{note.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(note.createdAt)}
                {note.visibleToAgent ? " · visible para IA" : ""}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
