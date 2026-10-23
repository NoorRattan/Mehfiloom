"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { Flower } from "./chrome";

const Scene = dynamic(() => import("./sculpture-scene"), {
  ssr: false,
  loading: () => <Flower className="sculpture-fallback" />,
});
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Flower className="sculpture-fallback" />
    ) : (
      this.props.children
    );
  }
}
export default function Sculpture() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [spin, setSpin] = useState(0);
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(max-width: 760px)").matches
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "80px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="sculpture-wrap" ref={ref}>
      <div className="sculpture-canvas" aria-hidden="true">
        <SceneBoundary>
          {visible ? (
            <Scene spin={spin} />
          ) : (
            <Flower className="sculpture-fallback" />
          )}
        </SceneBoundary>
      </div>
      <button
        className="sculpture-spin"
        onClick={() => setSpin((value) => value + 1)}
      >
        <RotateCw size={13} /> A little twist of joy
      </button>
    </div>
  );
}
