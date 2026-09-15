export const PAYMENT_METHODS = [
  "pagomovil",
  "transferencia",
  "binance",
  "zelle",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentAccountField = {
  label: string;
  value: string;
  copyable?: boolean;
};

export type PaymentMethodInfo = {
  id: PaymentMethod;
  name: string;
  currency: string;
  subtitle: string;
  note?: string;
  fields: PaymentAccountField[];
};

export const PAYMENT_METHODS_CONFIG: Record<PaymentMethod, PaymentMethodInfo> = {
  pagomovil: {
    id: "pagomovil",
    name: "Pago Móvil",
    currency: "VES",
    subtitle: "Bolívares a tasa oficial BCV del día",
    note: "Calcula el monto al cambio oficial BCV al momento de realizar la transacción.",
    fields: [
      { label: "Banco", value: "Banesco (0134)", copyable: false },
      { label: "Teléfono", value: "0412-1234567", copyable: true },
      { label: "Cédula / RIF", value: "J-50123456-7", copyable: true },
      { label: "Titular", value: "Innover Suite C.A.", copyable: false },
    ],
  },
  transferencia: {
    id: "transferencia",
    name: "Transferencia Bancaria",
    currency: "VES",
    subtitle: "Transferencia en Bolívares",
    note: "Si transfieres desde otro banco, la confirmación puede tardar hasta 24 horas hábiles.",
    fields: [
      { label: "Banco", value: "Banesco Banco Universal", copyable: false },
      { label: "Número de cuenta", value: "0134-0000-00-0000000000", copyable: true },
      { label: "Cédula / RIF", value: "J-50123456-7", copyable: true },
      { label: "Titular", value: "Innover Suite C.A.", copyable: false },
      { label: "Tipo de cuenta", value: "Corriente", copyable: false },
    ],
  },
  binance: {
    id: "binance",
    name: "Binance Pay",
    currency: "USDT",
    subtitle: "Criptoactivo USDT sin comisión",
    note: "Envía el importe exacto en USDT mediante Binance Pay.",
    fields: [
      { label: "Binance Pay ID", value: "123456789", copyable: true },
      { label: "Correo asociado", value: "pagos@innover-suite.com", copyable: true },
      { label: "Criptomoneda", value: "USDT", copyable: false },
      { label: "Nombre de usuario", value: "InnoverSuitePay", copyable: false },
    ],
  },
  zelle: {
    id: "zelle",
    name: "Zelle",
    currency: "USD",
    subtitle: "Dólares vía Zelle (EE.UU.)",
    note: "En el concepto o memo escribe únicamente el nombre de tu empresa.",
    fields: [
      { label: "Correo Zelle", value: "pagos@innover-suite.com", copyable: true },
      { label: "Titular de la cuenta", value: "Innover Suite LLC", copyable: false },
    ],
  },
};

export const getPaymentMethodInfo = (method: string): PaymentMethodInfo | null => {
  if (method in PAYMENT_METHODS_CONFIG) {
    return PAYMENT_METHODS_CONFIG[method as PaymentMethod];
  }
  return null;
};
