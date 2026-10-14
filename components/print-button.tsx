"use client";

import { Printer } from "lucide-react";
import { btn } from "@/components/ui";

export function PrintButton() {
  return (
    <button type="button" className={btn("primary", "lg")} onClick={() => window.print()}>
      <Printer aria-hidden /> Print
    </button>
  );
}
