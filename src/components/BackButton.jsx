"use client";
import React, { useContext } from "react";
import { BackButtonContext } from "@/components/BackButtonContext";

export default function BackButton({ className = "", children = "Retour", isLayout = false }) {
  const { hideChildrenBackButtons } = useContext(BackButtonContext);
  // If a layout-level BackButton exists, hide page-level ones automatically
  if (!isLayout && hideChildrenBackButtons) return null;
  const base = "inline-flex items-center gap-1 text-blue-600 hover:underline cursor-pointer";
  return (
    <button type="button" className={`${base} ${className}`} onClick={() => window.history.back()}>
      {children}
    </button>
  );
}
