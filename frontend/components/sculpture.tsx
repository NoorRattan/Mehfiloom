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
    if (typeof IntersectionObserver === "undefined") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const smallScreen = window.matchMedia("(max-width: 760px)");
    let nearViewport = false;
    const refresh = () => setVisible(
      nearViewport && !reducedMotion.matches && !smallScreen.matches && document.visibilityState !== "hidden",
    );
    const observer = new IntersectionObserver(
      ([entry]) => {
        nearViewport = entry.isIntersecting;
        refresh();
      },
      { rootMargin: "80px" },
    );
    if (ref.current) observer.observe(ref.current);
    reducedMotion.addEventListener("change", refresh);
    smallScreen.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", refresh);
      smallScreen.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
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
        style={{ visibility: visible ? "visible" : "hidden" }}
        disabled={!visible}
        onClick={() => setSpin((value) => value + 1)}
      >
        <RotateCw size={13} /> A little twist of joy
      </button>
    </div>
  );
}
