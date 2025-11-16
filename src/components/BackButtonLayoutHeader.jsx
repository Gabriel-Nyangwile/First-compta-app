"use client";
import React from "react";
import BackButton from "@/components/BackButton";
import { BackButtonProvider } from "@/components/BackButtonContext";

export default function BackButtonLayoutHeader({ children, className = "" }) {
  return (
    <BackButtonProvider hideChildrenBackButtons>
      <div className={`mb-4 ${className}`}>
        <BackButton isLayout />
      </div>
      {children}
    </BackButtonProvider>
  );
}
