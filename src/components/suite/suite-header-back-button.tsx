"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const parentPath = (pathname: string) => {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  return `/${segments.slice(0, -1).join("/")}`;
};

export const SuiteHeaderBackButton = () => {
  const pathname = usePathname();
  const href = parentPath(pathname);

  if (!href) return null;

  return (
    <Button asChild variant="outline" size="icon" aria-label="Ir atrás">
      <Link href={href}>
        <ArrowLeft />
      </Link>
    </Button>
  );
};
