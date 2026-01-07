import * as React from "react";
import { Calendar, CalendarProps } from "./calendar";

/**
 * CalendarWrapper - Usa o Calendar padrão
 * O problema de clique dentro de Dialog/Popover é resolvido no Popover com modal={true}
 */
export function CalendarWrapper(props: CalendarProps) {
  return <Calendar {...props} />;
}
