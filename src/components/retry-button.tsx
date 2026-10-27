"use client";

import { useEffect } from "react";
import { RefreshIcon } from "./icons";
import { Button } from "./ui";

export function RetryButton() {
  useEffect(() => {
    const back = () => window.location.reload();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, []);
  return (
    <Button className="mt-8" size="lg" onClick={() => window.location.reload()}>
      <RefreshIcon size={18} /> Tentar de novo
    </Button>
  );
}
