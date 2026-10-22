"use client";

import { ArrowDownToLine, Printer, Upload } from "lucide-react";
import { useRef } from "react";

type PlanFileActionsProps = {
  onExport: () => void;
  onImport: (file: File) => void;
  onPrint: () => void;
};

export function PlanFileActions({ onExport, onImport, onPrint }: PlanFileActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button type="button" onClick={onExport}><ArrowDownToLine size={15} /> Export JSON</button>
      <button type="button" onClick={() => inputRef.current?.click()}><Upload size={15} /> Import JSON</button>
      <button type="button" onClick={onPrint}><Printer size={15} /> Print plan</button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        aria-label="Choose a Mehfiloom plan JSON file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onImport(file);
        }}
      />
    </>
  );
}
