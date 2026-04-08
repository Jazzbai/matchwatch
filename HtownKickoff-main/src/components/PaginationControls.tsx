"use client";

import React from "react";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ currentPage, totalPages, onPageChange }: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);

  const baseButtonStyle: React.CSSProperties = {
    minWidth: 40,
    height: 40,
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--foreground)",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s ease",
    padding: "0 14px",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 24,
      }}
    >
      <button
        type="button"
        onClick={() => onPageChange(1)}
        disabled={currentPage <= 1}
        style={{
          ...baseButtonStyle,
          opacity: currentPage <= 1 ? 0.45 : 1,
          cursor: currentPage <= 1 ? "not-allowed" : "pointer",
        }}
      >
        First
      </button>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        style={{
          ...baseButtonStyle,
          opacity: currentPage <= 1 ? 0.45 : 1,
          cursor: currentPage <= 1 ? "not-allowed" : "pointer",
        }}
      >
        Prev
      </button>
      {pageNumbers.map((pageNumber) => {
        const isActive = pageNumber === currentPage;
        return (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={isActive ? "page" : undefined}
            style={{
              ...baseButtonStyle,
              background: isActive ? "var(--primary)" : "var(--card)",
              borderColor: isActive ? "var(--primary)" : "var(--border)",
              color: isActive ? "var(--primary-foreground)" : "var(--foreground)",
            }}
          >
            {pageNumber}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        style={{
          ...baseButtonStyle,
          opacity: currentPage >= totalPages ? 0.45 : 1,
          cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
        }}
      >
        Next
      </button>
      <button
        type="button"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage >= totalPages}
        style={{
          ...baseButtonStyle,
          opacity: currentPage >= totalPages ? 0.45 : 1,
          cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
        }}
      >
        Last
      </button>
    </div>
  );
}
