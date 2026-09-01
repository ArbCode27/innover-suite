"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DollarSign, GripVertical, KanbanSquare, Loader2, Plus, Target, Users } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { CHANNEL_BADGE_CLASSNAMES, CHANNEL_LABELS } from "@/lib/contacts/display";
import { AppSelect } from "@/components/ui/app-select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { formatMoney } from "@/lib/commerce/types";
import { PriceCurrencyField } from "@/components/ui/price-currency-field";
import { DEFAULT_CURRENCY, type OrganizationCurrencySettings } from "@/lib/organizations/currencies";
import { createFunnelCardAction, moveFunnelCardAction } from "./actions";
import type { FunnelBoardView, FunnelCardView, FunnelContactOption, FunnelMetrics, FunnelStageView } from "./types";
import type { ListingOption } from "@/lib/listings/types";

type FunnelProductOption = {
  id: number;
  name: string;
  price: number;
  currency: string;
};

type FunnelBoardProps = {
  initialBoard: FunnelBoardView;
  contacts: FunnelContactOption[];
  listings?: ListingOption[];
  products?: FunnelProductOption[];
  currencies: OrganizationCurrencySettings;
};

const STAGE_DOT_COLORS = ["bg-sky-500", "bg-cyan-400", "bg-violet-400", "bg-emerald-400"];

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

const resolveOverStageId = (overId: string | number | undefined, stages: FunnelStageView[]) => {
  if (overId === undefined) return null;
  const stageId = parseStageId(overId);
  if (stageId) return stageId;
  const cardId = parseCardId(overId);
  if (!cardId) return null;
  return stages.find((stage) => stage.cards.some((card) => card.id === cardId))?.id ?? null;
};

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length) {
    return pointerCollisions;
  }
  return closestCorners(args);
};

const FunnelCardBody = ({ card, isOverlay = false }: { card: FunnelCardView; isOverlay?: boolean }) => {
  const titleIsContact =
    card.title.trim().localeCompare(card.contactName.trim(), undefined, { sensitivity: "accent" }) === 0;
  const productLabel = card.productName || card.listingTitle;
  const price = card.productPrice ?? card.valueAmount;
  const currency = card.productCurrency ?? card.currency ?? DEFAULT_CURRENCY;

  return (
    <div className="flex items-start gap-2.5">
      {isOverlay ? <GripVertical className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> : null}
      <Avatar size="sm">
        <AvatarFallback>{resolveInitials(card.contactName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{card.contactName}</p>
        {titleIsContact ? null : (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.title}</p>
        )}
        {productLabel || price != null ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {productLabel || "Producto"}
            {price != null ? ` · ${formatMoney(price, currency)}` : ""}
          </p>
        ) : null}
        {card.channel ? (
          <div className="mt-2">
            <Badge variant="outline" className={CHANNEL_BADGE_CLASSNAMES[card.channel]}>
              {CHANNEL_LABELS[card.channel]}
            </Badge>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const SortableFunnelCard = ({ card }: { card: FunnelCardView }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDndId(card.id),
    data: { type: "card", cardId: card.id, stageId: card.stageId },
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`cursor-grab rounded-xl border border-primary/15 bg-background p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <FunnelCardBody card={card} />
    </article>
  );
};

const StageColumn = ({
  stage,
  colorClass,
  isDropTarget,
}: {
  stage: FunnelStageView;
  colorClass: string;
  isDropTarget: boolean;
}) => {
  const { setNodeRef } = useDroppable({
    id: stageDndId(stage.id),
    data: { type: "stage", stageId: stage.id },
  });

  return (
    <Card
      ref={setNodeRef}
      className={`flex min-h-0 flex-col overflow-hidden transition-all duration-150 ${
        isDropTarget
          ? "border-primary bg-primary/12 shadow-lg shadow-primary/20 ring-2 ring-primary"
          : "border-primary/15 bg-card/70"
      }`}
    >
      <CardHeader className="shrink-0 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`size-2.5 shrink-0 rounded-full ${colorClass}`} />
            <CardTitle className="truncate text-sm">{stage.name}</CardTitle>
          </div>
          <Badge variant={isDropTarget ? "default" : "outline"}>
            {isDropTarget ? "Soltar aquí" : stage.cards.length}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {isDropTarget
            ? "Suelta para mover a esta etapa"
            : stage.cards.length
              ? `${stage.cards.length} ${stage.cards.length === 1 ? "oportunidad" : "oportunidades"}`
              : "Sin tarjetas"}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto p-3 pt-0">
        <SortableContext items={stage.cards.map((card) => cardDndId(card.id))} strategy={verticalListSortingStrategy}>
          <div className="flex min-h-full flex-col gap-2">
            {stage.cards.length ? (
              stage.cards.map((card) => <SortableFunnelCard key={card.id} card={card} />)
            ) : (
              <div
                className={`flex min-h-32 flex-1 flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition-colors ${
                  isDropTarget
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-primary/20 bg-primary/8 text-muted-foreground"
                }`}
              >
                <KanbanSquare className="mb-2 size-6" />
                <p className="text-xs font-medium">{isDropTarget ? "Suelta aquí" : "Arrastra una oportunidad"}</p>
              </div>
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
};

export const FunnelBoard = ({ initialBoard, contacts, listings = [], products = [], currencies }: FunnelBoardProps) => {
  const [board, setBoard] = useState(initialBoard);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [contactId, setContactId] = useState(contacts[0]?.id ? String(contacts[0].id) : "");
  const [stageId, setStageId] = useState(initialBoard.stages[0]?.id ? String(initialBoard.stages[0].id) : "");
  const [title, setTitle] = useState(contacts[0]?.fullName ?? "");
  const [valueAmount, setValueAmount] = useState("");
  const [valueCurrency, setValueCurrency] = useState(currencies.defaultCode);
  const [listingId, setListingId] = useState("");
  const [productId, setProductId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<FunnelCardView | null>(null);
  const [overStageId, setOverStageId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const metrics = useMemo(() => computeMetrics(board.stages), [board.stages]);
  const metricItems = [
    { label: "Oportunidades", value: String(metrics.opportunityCount), icon: Target },
    { label: "Valor estimado", value: formatMoney(metrics.estimatedValue, currencies.defaultCode), icon: DollarSign },
    { label: "Contactos activos", value: String(metrics.contactCount), icon: Users },
    { label: "Etapas", value: String(metrics.stageCount), icon: KanbanSquare },
  ];

  const handleProductChange = (nextProductId: string) => {
    setProductId(nextProductId);
    const selected = products.find((item) => String(item.id) === nextProductId);
    if (!selected) return;
    if (!valueAmount.trim()) {
      setValueAmount(String(selected.price));
    }
    setValueCurrency(selected.currency || currencies.defaultCode);
  };

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
        currency: parsedValue === undefined ? undefined : valueCurrency,
        listingId: listingId ? Number(listingId) : undefined,
        productId: productId ? Number(productId) : undefined,
      });

      if (result.error || !result.data?.card) {
        const message = result.error ?? "No se pudo crear la oportunidad.";
        setFormError(message);
        toast.error(message);
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
      setValueCurrency(currencies.defaultCode);
      setProductId("");
      setListingId("");
      toast.success("Oportunidad agregada al embudo");
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const cardId = parseCardId(event.active.id);
    if (!cardId) return;
    const card = board.stages.flatMap((stage) => stage.cards).find((item) => item.id === cardId) ?? null;
    setActiveCard(card);
    setOverStageId(card?.stageId ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const nextStageId = resolveOverStageId(event.over?.id, board.stages);
    setOverStageId(nextStageId);
  };

  const handleDragCancel = () => {
    setActiveCard(null);
    setOverStageId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeCardId = parseCardId(event.active.id);
    const overId = event.over?.id;
    setActiveCard(null);
    setOverStageId(null);
    if (!activeCardId || !overId) return;

    const sourceStage = board.stages.find((stage) => stage.cards.some((card) => card.id === activeCardId));
    const sourceCard = sourceStage?.cards.find((card) => card.id === activeCardId);
    if (!sourceStage || !sourceCard) return;

    const overCardId = parseCardId(overId);
    const destinationStageId = resolveOverStageId(overId, board.stages);
    if (!destinationStageId) return;

    const destinationStage = board.stages.find((stage) => stage.id === destinationStageId);
    if (!destinationStage) return;

    const destinationCards = destinationStage.cards.filter((card) => card.id !== activeCardId);
    let destinationIndex = destinationCards.length;
    if (overCardId) {
      const overIndex = destinationCards.findIndex((card) => card.id === overCardId);
      destinationIndex = overIndex >= 0 ? overIndex : destinationCards.length;
    }

    const persistMove = (targetStageId: number, successMessage: string, previousBoard: FunnelBoardView) => {
      startTransition(async () => {
        try {
          const result = await moveFunnelCardAction({
            cardId: activeCardId,
            stageId: targetStageId,
            position: destinationIndex,
          });
          if (result.error) {
            toastActionError(result);
            setBoard(previousBoard);
            return;
          }
          toast.success(successMessage);
        } catch {
          toast.error("No se pudo actualizar la oportunidad.");
          setBoard(previousBoard);
        }
      });
    };

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
      persistMove(sourceStage.id, "Oportunidad actualizada correctamente", previousBoard);
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

    persistMove(destinationStage.id, `Oportunidad movida a ${destinationStage.name}`, previousBoard);
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {metricItems.map((metric) => (
          <Card key={metric.label} className="border-primary/15 bg-card/70 py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <CardDescription className="text-[11px]">{metric.label}</CardDescription>
                <CardTitle className="mt-1 truncate text-lg">{metric.value}</CardTitle>
              </div>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <metric.icon className="size-4" />
              </span>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-end">
        <Button type="button" onClick={() => setIsSheetOpen(true)} disabled={!contacts.length}>
          <Plus />
          Nueva oportunidad
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid min-h-[calc(100vh-17rem)] grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {board.stages.map((stage, index) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              colorClass={STAGE_DOT_COLORS[index % STAGE_DOT_COLORS.length]!}
              isDropTarget={activeCard !== null && overStageId === stage.id}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null} zIndex={80}>
          {activeCard ? (
            <article className="w-[260px] rotate-1 cursor-grabbing rounded-xl border border-primary bg-background p-3 shadow-2xl shadow-primary/30 ring-2 ring-primary">
              <FunnelCardBody card={activeCard} isOverlay />
            </article>
          ) : null}
        </DragOverlay>
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
              <AppSelect
                id="funnel-contact"
                aria-label="Contacto"
                value={contactId}
                onValueChange={handleContactChange}
                placeholder="Selecciona un contacto"
                options={contacts.map((contact) => ({
                  value: String(contact.id),
                  label: contact.fullName,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="funnel-stage">Etapa</Label>
              <AppSelect
                id="funnel-stage"
                aria-label="Etapa"
                value={stageId}
                onValueChange={setStageId}
                options={board.stages.map((stage) => ({
                  value: String(stage.id),
                  label: stage.name,
                }))}
              />
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
            <PriceCurrencyField
              id="funnel-value"
              label="Valor estimado (opcional)"
              amount={valueAmount}
              currency={valueCurrency}
              currencies={currencies}
              placeholder="0"
              onAmountChange={setValueAmount}
              onCurrencyChange={setValueCurrency}
            />
            {products.length ? (
              <div className="space-y-2">
                <Label htmlFor="funnel-product">Producto</Label>
                <AppSelect
                  id="funnel-product"
                  aria-label="Producto"
                  value={productId}
                  onValueChange={handleProductChange}
                  placeholder="Sin producto"
                  options={[
                    { value: "", label: "Sin producto" },
                    ...products.map((item) => ({
                      value: String(item.id),
                      label: `${item.name} · ${formatMoney(item.price, item.currency)}`,
                    })),
                  ]}
                />
              </div>
            ) : null}
            {listings.length ? (
              <div className="space-y-2">
                <Label htmlFor="funnel-listing">Inmueble</Label>
                <AppSelect
                  id="funnel-listing"
                  aria-label="Inmueble"
                  value={listingId}
                  onValueChange={setListingId}
                  placeholder="Sin inmueble"
                  options={[
                    { value: "", label: "Sin inmueble" },
                    ...listings.map((item) => ({
                      value: String(item.id),
                      label: `${item.code} · ${item.title}`,
                    })),
                  ]}
                />
              </div>
            ) : null}
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
