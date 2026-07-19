"use client";

import { useEffect, useRef, type ReactNode } from "react";

import {
  CloseIcon,
  HeartIcon,
  InfoIcon,
  MenuGridIcon,
} from "@/components/icons";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

interface MobileDrawerProps {
  /** The category navigation to mirror the desktop sidebar. */
  readonly children: ReactNode;
  /** True while the exit animation plays; the drawer unmounts via onClosed. */
  readonly closing?: boolean;
  readonly favoritesActive: boolean;
  readonly favoritesCount: number;
  readonly onClose: () => void;
  /** Fired once the exit animation ends (or immediately under reduced motion). */
  readonly onClosed?: () => void;
  readonly onSelectFavorites: () => void;
  readonly onSelectMenu: () => void;
}

// Mount/unmount drives focus capture and restore; the parent keeps this mounted
// through `closing` so the exit animation can play before onClosed unmounts it.
export function MobileDrawer({
  children,
  closing = false,
  favoritesActive,
  favoritesCount,
  onClose,
  onClosed,
  onSelectFavorites,
  onSelectMenu,
}: MobileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  // Drive the unmount off the panel's exit animation, with a timeout fallback in
  // case animationend never fires and an instant path under reduced motion.
  useEffect(() => {
    if (!closing) {
      return;
    }
    const panel = panelRef.current;
    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduceMotion || panel === null) {
      onClosed?.();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      onClosed?.();
    };
    panel.addEventListener("animationend", finish);
    const timer = window.setTimeout(finish, 250);
    return () => {
      panel.removeEventListener("animationend", finish);
      window.clearTimeout(timer);
    };
  }, [closing, onClosed]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={`mobile-drawer${closing ? " is-closing" : ""}`}>
      <button
        aria-hidden="true"
        aria-label="Close menu overlay"
        className="mobile-drawer__scrim"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-label="Menu navigation"
        aria-modal="true"
        className="mobile-drawer__panel"
        id="mobile-drawer"
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="mobile-drawer__header">
          <span className="mobile-drawer__title">Menu Explorer</span>
          <button
            aria-label="Close menu"
            className="icon-button mobile-drawer__close"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
        {children}
        <nav aria-label="App navigation" className="mobile-drawer__app-nav">
          <button
            aria-current={favoritesActive ? undefined : "page"}
            className={`mobile-drawer__app-link${favoritesActive ? "" : " is-current"}`}
            onClick={onSelectMenu}
            type="button"
          >
            <MenuGridIcon size={20} />
            Menu
          </button>
          <button
            aria-current={favoritesActive ? "true" : undefined}
            className={`mobile-drawer__app-link${favoritesActive ? " is-current" : ""}`}
            onClick={onSelectFavorites}
            type="button"
          >
            <HeartIcon size={20} />
            Favorites
            {favoritesCount > 0 ? (
              <span className="mobile-drawer__app-count">{favoritesCount}</span>
            ) : null}
          </button>
          <span aria-disabled="true" className="mobile-drawer__app-link">
            <InfoIcon size={20} />
            About
          </span>
        </nav>
      </div>
    </div>
  );
}
