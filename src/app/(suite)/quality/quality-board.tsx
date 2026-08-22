"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reviewAgentTurnAction } from "@/lib/agent/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TurnRow = {
  id: number;
  status: string;
  error: string | null;
  lastModel: string | null;
  reviewScore: number | null;
  reviewNotes: string | null;
  createdAt: string;
  conversationId: number;
};

export const QualityBoard = ({ turns }: { turns: TurnRow[] }) => {
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [isPending, startTransition] = useTransition();

  const handleScore = (turnId: number, score: number) => {
    startTransition(async () => {
      const result = await reviewAgentTurnAction({
        turnId,
        score,
        notes: notes[turnId],
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
    });
  };

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader>
        <CardTitle>Turnos recientes</CardTitle>
        <CardDescription>1 es mala respuesta, 5 es excelente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {turns.length ? (
          turns.map((turn) => (
            <article key={turn.id} className="rounded-xl border border-primary/10 bg-background/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  #{turn.id} · {turn.status}
                  {turn.lastModel ? ` · ${turn.lastModel}` : ""}
                </p>
                <Link className="text-xs text-primary hover:underline" href={`/inbox?conversation=${turn.conversationId}`}>
                  Ver chat
                </Link>
              </div>
              {turn.error ? <p className="mt-1 text-xs text-destructive">{turn.error}</p> : null}
              <input
                className="mt-2 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                placeholder="Nota de revisión"
                value={notes[turn.id] ?? turn.reviewNotes ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [turn.id]: event.target.value }))}
                aria-label={`Nota del turno ${turn.id}`}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {[1, 2, 3, 4, 5].map((score) => (
                  <Button
                    key={score}
                    type="button"
                    size="sm"
                    variant={turn.reviewScore === score ? "default" : "outline"}
                    disabled={isPending}
                    onClick={() => handleScore(turn.id, score)}
                  >
                    {isPending ? <Loader2 className="animate-spin" /> : score}
                  </Button>
                ))}
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay turnos del agente para revisar.</p>
        )}
      </CardContent>
    </Card>
  );
};
