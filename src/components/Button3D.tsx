"use client";

import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import Tilt3D from "./Tilt3D";

const base = "btn-3d relative rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors";
const variants = {
  primary: `${base} btn-3d-primary bg-[var(--tarragona-red)] text-white hover:bg-[#ff1f45]`,
  secondary: `${base} border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`,
};

export function Button3D({
  variant = "primary",
  className = "",
  fullWidth = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary"; fullWidth?: boolean }) {
  return (
    <Tilt3D className={fullWidth ? "block w-full" : ""}>
      <button className={`${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`} {...props}>
        <span className="btn-3d-shine" />
        <span className="relative">{children}</span>
      </button>
    </Tilt3D>
  );
}

export function LinkButton3D({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tilt3D>
      <Link href={href} className={`inline-block ${variants[variant]} ${className}`}>
        <span className="btn-3d-shine" />
        <span className="relative">{children}</span>
      </Link>
    </Tilt3D>
  );
}
