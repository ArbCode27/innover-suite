"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DollarSign, KanbanSquare, Loader2, Plus, Target, Users } from "lucide-react";
import { toast } from "sonner";
import { CHANNEL_LABELS } from "@/lib/contacts/display";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createFunnelCardAction, moveFunnelCardAction } from "./actions";
import type { FunnelBoardView, FunnelCardView, FunnelContactOption, FunnelMetrics, FunnelStageView } from "./types";

type FunnelBoardProps = {
  initialBoard: FunnelBoardView;
  contacts: FunnelContactOption[];
};

const STAGE_DOT_COLORS = ["bg-sky-500", "bg-cyan-400", "bg-violet-400", "bg-emerald-400"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const resolveInitials = (name: string) => {
  const words = name.replace(/^@/, "").trim().split(" ").filter(Boolean);
  if (!words.length) return "SN";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
};

const stageDndId = (stageId: number) => `stage-${stageId}`;
const cardDndId = (cardId: number) => `card-${cardId}`;
const parseStageId = (value: string | number) => {
  const raw = String(value);
  if (!raw.startsWith("stage-")) return null;
  const parsed = Number(raw.slice("stage-".length));
  return Number.isInteger(parsed) ? parsed : null;
};
const parseCardId = (value: string | number) => {
  const raw = String(value);
  if (!raw.startsWith("card-")) return null;
  const parsed = Number(raw.slice("card-".length));
  return Number.isInteger(parsed) ? parsed : null;
};

const computeMetrics = (stages: FunnelStageView[]): FunnelMetrics => {
  const cards = stages.flatMap((stage) => stage.cards);
  const contactIds = new Set(cards.map((card) => card.contactId));
  return {
    opportunityCount: cards.length,
    estimatedValue: cards.reduce((total, card) => total + (card.valueAmount ?? 0), 0),
    contactCount: contactIds.size,
    stageCount: stages.length,
  };
};

const SortableFunnelCard = ({ card }: { card: FunnelCardView }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDndId(card.id),
    data: { type: "card", cardId: card.id, stageId: card.stageId },
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border border-primary/15 bg-background p-3 shadow-sm ${
        isDragging ? "z-10 opacity-80" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2.5">
        <Avatar size="sm">
          <AvatarFallback>{resolveInitials(card.contactName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{card.contactName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {card.channel ? (
              <Badge variant="outline">{CHANNEL_LABELS[card.channel]}</Badge>
            ) : (
              <Badge variant="outline">Manual</Badge>
            )}
            {card.valueAmount ? <Badge variant="outline">{formatCurrency(card.valueAmount)}</Badge> : null}
          </div>
        </div>
      </div>
    </article>
  );
};

const StageColumn = ({
  stage,
  colorClass,
}: {
  stage: FunnelStageView;
  colorClass: string;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stageDndId(stage.id),
    data: { type: "stage", stageId: stage.id },
  });

  return (
    <Card className={`flex min-h-[420px] min-w-[260px] flex-col border-primary/15 bg-card/70 ${isOver ? "ring-2 ring-primary/30" : ""}`}>
      <CardHeader className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`size-2.5 rounded-full ${colorClass}`} />
            <CardTitle className="text-base">{stage.name}</CardTitle>
          </div>
          <Badge variant="outline">{stage.cards.length}</Badge>
        </div>
        <CardDescription>
          {stage.cards.length ? `${stage.cards.length} oportunidades` : "Sin tarjetas en esta etapa"}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-4 pt-0">
        <SortableContext items={stage.cards.map((card) => cardDndId(card.id))} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="flex min-h-56 flex-col gap-2.5">
            {stage.cards.length ? (
              stage.cards.map((card) => <SortableFunnelCard key={card.id} card={card} />)
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-primary/8 p-5 text-center">
                <KanbanSquare className="mb-3 size-7 text-primary" />
                <p className="text-sm font-medium">Suelta oportunidades aquí</p>
              </div>
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
};

export const FunnelBoard = ({ initialBoard, contacts }: FunnelBoardProps) => {
  const [board, setBoard] = useState(initialBoard);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [contactId, setContactId] = useState(contacts[0]?.id ? String(contacts[0].id) : "");
  const [stageId, setStageId] = useState(initialBoard.stages[0]?.id ? String(initialBoard.stages[0].id) : "");
  const [title, setTitle] = useState(contacts[0]?.fullName ?? "");
  const [valueAmount, setValueAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const metrics = useMemo(() => computeMetrics(board.stages), [board.stages]);
  const metricItems = [
    { label: "Oportunidades", value: String(metrics.opportunityCount), icon: Target },
    { label: "Valor estimado", value: formatCurrency(metrics.estimatedValue), icon: DollarSign },
    { label: "Contactos activos", value: String(metrics.contactCount), icon: Users },
    { label: "Etapas", value: String(metrics.stageCount), icon: KanbanSquare },
  ];

  const handleContactChange = (nextContactId: string) => {
    setContactId(nextContactId);
    const selected = contacts.find((item) => String(item.id) === nextContactId);
    if (selected) {
      setTitle(selected.fullName);
    }
  };

  const handleCreateCard = () => {
    const selectedContactId = Number(contactId);
    const selectedStageId = Number(stageId);
    const parsedValue = valueAmount.trim() ? Number(valueAmount) : undefined;

    if (!selectedContactId || !selectedStageId || !title.trim()) {
      setFormError("Selecciona un contacto, una etapa y un título.");
      return;
    }

    if (parsedValue !== undefined && (!Number.isFinite(parsedValue) || parsedValue < 0)) {
      setFormError("El valor estimado no es válido.");
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const result = await createFunnelCardAction({
        contactId: selectedContactId,
        stageId: selectedStageId,
        title: title.trim(),
        valueAmount: parsedValue,
      });

      if (result.error || !result.data?.card) {
        setFormError(result.error ?? "No se pudo crear la oportunidad.");
        return;
      }

      const created = result.data.card;
      setBoard((current) => ({
        ...current,
        stages: current.stages.map((stage) =>
          stage.id === created.stageId ? { ...stage, cards: [...stage.cards, created] } : stage,
        ),
      }));
      setIsSheetOpen(false);
      setValueAmount("");
      toast.success("Oportunidad agregada al embudo");
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeCardId = parseCardId(event.active.id);
    if (!activeCardId) return;

    const overId = event.over?.id;
    if (!overId) return;

    const sourceStage = board.stages.find((stage) => stage.cards.some((card) => card.id === activeCardId));
    const sourceCard = sourceStage?.cards.find((card) => card.id === activeCardId);
    if (!sourceStage || !sourceCard) return;

    const overCardId = parseCardId(overId);
    const overStageId = overCardId
      ? board.stages.find((stage) => stage.cards.some((card) => card.id === overCardId))?.id ?? null
      : parseStageId(overId);

    if (!overStageId) return;

    const destinationStage = board.stages.find((stage) => stage.id === overStageId);
    if (!destinationStage) return;

    const destinationCards = destinationStage.cards.filter((card) => card.id !== activeCardId);
    let destinationIndex = destinationCards.length;
    if (overCardId) {
      const overIndex = destinationCards.findIndex((card) => card.id === overCardId);
      destinationIndex = overIndex >= 0 ? overIndex : destinationCards.length;
    }

    if (sourceStage.id === destinationStage.id) {
      const oldIndex = sourceStage.cards.findIndex((card) => card.id === activeCardId);
      if (oldIndex === destinationIndex) return;
      const previousBoard = board;
      const reordered = arrayMove(sourceStage.cards, oldIndex, destinationIndex).map((card, index) => ({
        ...card,
        position: index,
      }));
      setBoard((current) => ({
        ...current,
        stages: current.stages.map((stage) => (stage.id === sourceStage.id ? { ...stage, cards: reordered } : stage)),
      }));
      startTransition(async () => {
        const result = await moveFunnelCardAction({
          cardId: activeCardId,
          stageId: sourceStage.id,
          position: destinationIndex,
        });
        if (result.error) {
          toast.error(result.error);
          setBoard(previousBoard);
        }
      });
      return;
    }

    const previousBoard = board;
    const movedCard = { ...sourceCard, stageId: destinationStage.id, position: destinationIndex };
    setBoard((current) => ({
      ...current,
      stages: current.stages.map((stage) => {
        if (stage.id === sourceStage.id) {
          return { ...stage, cards: stage.cards.filter((card) => card.id !== activeCardId) };
        }
        if (stage.id === destinationStage.id) {
          const nextCards = [...destinationCards];
          nextCards.splice(destinationIndex, 0, movedCard);
          return { ...stage, cards: nextCards.map((card, index) => ({ ...card, position: index })) };
        }
        return stage;
      }),
    }));

    startTransition(async () => {
      const result = await moveFunnelCardAction({
        cardId: activeCardId,
        stageId: destinationStage.id,
        position: destinationIndex,
      });
      if (result.error) {
        toast.error(result.error);
        setBoard(previousBoard);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" onClick={() => setIsSheetOpen(true)} disabled={!contacts.length}>
          <Plus />
          Nueva oportunidad
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {metricItems.map((metric) => (
          <Card key={metric.label} className="border-primary/15 bg-card/70">
            <CardHeader className="flex flex-row items-center justify-between gap-3 p-4">
              <div>
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className="mt-2 text-3xl">{metric.value}</CardTitle>
              </div>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <metric.icon className="size-5" />
              </span>
            </CardHeader>
          </Card>
        ))}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <ScrollArea className="w-full">
          <div className="flex min-w-max gap-4 pb-2">
            {board.stages.map((stage, index) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                colorClass={STAGE_DOT_COLORS[index % STAGE_DOT_COLORS.length]!}
              />
            ))}
          </div>
        </ScrollArea>
      </DndContext>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nueva oportunidad</SheetTitle>
            <SheetDescription>
              Elige un contacto real del CRM. Un mismo contacto solo puede estar una vez en el embudo.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-2">
              <Label htmlFor="funnel-contact">Contacto</Label>
              <select
                id="funnel-contact"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={contactId}
                onChange={(event) => handleContactChange(event.target.value)}
              >
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="funnel-stage">Etapa</Label>
              <select
                id="funnel-stage"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={stageId}
                onChange={(event) => setStageId(event.target.value)}
              >
                {board.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="funnel-title">Título</Label>
              <Input
                id="funnel-title"
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="funnel-value">Valor estimado (opcional)</Label>
              <Input
                id="funnel-value"
                inputMode="decimal"
                value={valueAmount}
                placeholder="0"
                onChange={(event) => setValueAmount(event.target.value)}
              />
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            {!contacts.length ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay contactos. Cuando lleguen chats de Instagram o WhatsApp podrás crear oportunidades.
              </p>
            ) : null}
          </div>
          <SheetFooter>
            <Button type="button" onClick={handleCreateCard} disabled={isPending || !contacts.length}>
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Agregar al embudo
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};
