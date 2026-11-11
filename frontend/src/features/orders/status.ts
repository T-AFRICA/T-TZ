/** Customer-facing labels for the order statuses of migration 0004. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  dispatched: "Dispatched",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Order numbers as issued by place_cod_order: TZ-YYMMDD-XXXXXXXX. */
export const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,40}$/;
