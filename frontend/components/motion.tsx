"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={{ opacity: [0.65, 1], y: reduced ? 0 : [24, 0] }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{
        duration: reduced ? 0 : 0.75,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      autoRaf: true,
      duration: 1.05,
      anchors: true,
      prevent: (node) => node.hasAttribute("data-lenis-prevent"),
    });
    return () => lenis.destroy();
  }, []);
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

export function Magnetic({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`magnetic ${className}`}
      onPointerMove={(event) => {
        if (
          event.pointerType !== "mouse" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          !ref.current
        )
          return;
        const bounds = ref.current.getBoundingClientRect();
        gsap.to(ref.current, {
          x: (event.clientX - bounds.left - bounds.width / 2) * 0.12,
          y: (event.clientY - bounds.top - bounds.height / 2) * 0.18,
          duration: 0.5,
          ease: "power3.out",
        });
      }}
      onPointerLeave={() =>
        gsap.to(ref.current, {
          x: 0,
          y: 0,
          duration: 0.7,
          ease: "elastic.out(1, 0.5)",
        })
      }
    >
      {children}
    </div>
  );
}
