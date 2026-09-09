"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatPrecio, type GrupoModificador, type OpcionModificador } from "@/types/pedido";

type ModifierGroupSelectorProps = {
  grupo: GrupoModificador;
  selected: OpcionModificador[];
  onChange: (next: OpcionModificador[]) => void;
};

export const ModifierGroupSelector = ({ grupo, selected, onChange }: ModifierGroupSelectorProps) => {
  const selectedIds = new Set(selected.map((opcion) => opcion.id));
  const isSingle = grupo.seleccionMaxima === 1;

  const handleToggle = (opcion: OpcionModificador, checked: boolean) => {
    if (isSingle) {
      onChange(checked ? [opcion] : []);
      return;
    }
    if (checked) {
      if (selected.length >= grupo.seleccionMaxima) return;
      onChange([...selected, opcion]);
      return;
    }
    onChange(selected.filter((entry) => entry.id !== opcion.id));
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 p-4">
      <div>
        <h3 className="text-sm font-semibold">
          {grupo.titulo}
          {grupo.obligatorio ? <span className="text-destructive"> *</span> : null}
        </h3>
        <p className="text-xs text-muted-foreground">
          {isSingle
            ? "Selecciona una opción"
            : `Hasta ${grupo.seleccionMaxima} opciones${grupo.obligatorio ? ` · mínimo ${grupo.seleccionMinima}` : ""}`}
        </p>
      </div>

      {isSingle ? (
        <RadioGroup
          value={selected[0]?.id ?? ""}
          onValueChange={(value) => {
            const opcion = grupo.opciones.find((entry) => entry.id === value);
            onChange(opcion ? [opcion] : []);
          }}
          className="space-y-2"
        >
          {grupo.opciones.map((opcion) => (
            <label
              key={opcion.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5"
            >
              <span className="flex items-center gap-3">
                <RadioGroupItem value={opcion.id} id={`${grupo.id}-${opcion.id}`} />
                <Label htmlFor={`${grupo.id}-${opcion.id}`} className="cursor-pointer font-normal">
                  {opcion.nombre}
                </Label>
              </span>
              <span className="text-xs text-muted-foreground">
                {opcion.precioAdicional > 0 ? `+${formatPrecio(opcion.precioAdicional)}` : "Incluido"}
              </span>
            </label>
          ))}
        </RadioGroup>
      ) : (
        <div className="space-y-2">
          {grupo.opciones.map((opcion) => {
            const checked = selectedIds.has(opcion.id);
            return (
              <label
                key={opcion.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5"
              >
                <span className="flex items-center gap-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => handleToggle(opcion, value === true)}
                    disabled={!checked && selected.length >= grupo.seleccionMaxima}
                  />
                  <span className="text-sm">{opcion.nombre}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {opcion.precioAdicional > 0 ? `+${formatPrecio(opcion.precioAdicional)}` : "Incluido"}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
};
