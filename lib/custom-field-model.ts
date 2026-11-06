import { z } from "zod";

export const fieldTypes = {
  TEXT: "Texto",
  TEXTAREA: "Texto largo",
  NUMBER: "Número",
  MONEY: "Dinero",
  DROPDOWN: "Lista desplegable",
  LABELS: "Etiquetas",
  DATE: "Fecha",
  CHECKBOX: "Casilla",
  URL: "Sitio web",
  EMAIL: "Email",
  PHONE: "Teléfono",
  RATING: "Valoración",
  PROGRESS: "Progreso",
  FORMULA: "Fórmula",
} as const;
export const locationSchema = z.object({
  type: z.enum(["SPACE", "LIST"]),
  id: z.string().min(1).max(200),
});
export type FieldLocation = z.infer<typeof locationSchema>;
export const fieldSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(
      Object.keys(fieldTypes) as [
        keyof typeof fieldTypes,
        ...(keyof typeof fieldTypes)[],
      ],
    ),
    description: z.string().trim().max(1000).default(""),
    options: z
      .array(
        z.object({
          id: z.string().min(1).max(200).optional(),
          label: z.string().trim().min(1).max(100),
          color: z.string().regex(/^#[0-9a-f]{6}$/i),
        }),
      )
      .max(500)
      .default([]),
    locations: z.array(locationSchema).min(1).max(200),
    required: z.boolean().optional(),
    adminOnly: z.boolean().optional(),
    readerIds: z.array(z.string().min(1).max(200)).max(200).optional(),
    editorIds: z.array(z.string().min(1).max(200)).max(200).optional(),
    defaultValue: z.unknown().optional(),
    formula: z.string().trim().max(1000).optional(),
    revision: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, ctx) => {
    const selectable = ["DROPDOWN", "LABELS"].includes(value.type);
    if (selectable && !value.options.length)
      ctx.addIssue({
        code: "custom",
        message: "Agregá al menos una opción.",
        path: ["options"],
      });
    if (!selectable && value.options.length)
      ctx.addIssue({
        code: "custom",
        message: "Este tipo no admite opciones.",
        path: ["options"],
      });
    const labels = value.options.map((o) => o.label.toLocaleLowerCase());
    if (new Set(labels).size !== labels.length)
      ctx.addIssue({
        code: "custom",
        message: "Las opciones deben tener nombres diferentes.",
        path: ["options"],
      });
  });
export type FieldInput = z.infer<typeof fieldSchema>;
export type ManagedField = {
  id: string;
  name: string;
  type: keyof typeof fieldTypes;
  description: string;
  options: { id: string; label: string; color: string; position: number }[];
  locations: (FieldLocation & { name: string })[];
  revision: number;
  canEdit: boolean;
  required?: boolean; adminOnly?: boolean; readerIds?: string[]; editorIds?: string[]; defaultValue?: unknown; formula?: string;
  createdBy: string | null;
  createdAt: number | null;
};
export type FieldCatalog = {
  fields: ManagedField[];
  locations: (FieldLocation & {
    name: string;
    parentId?: string;
    canEdit: boolean;
  })[];
};
export function sameLocation(a: FieldLocation, b: FieldLocation) {
  return a.type === b.type && a.id === b.id;
}
