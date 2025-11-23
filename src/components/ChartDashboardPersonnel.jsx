"use client";
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function ChartDashboardPersonnel({ data, height=120 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const labels = data.map(d => `${d.month}/${String(d.year).slice(-2)}`);
    const chart = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "line",
            label: "Actifs fin mois",
            data: data.map(d => d.activeEnd),
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79,70,229,0.12)",
            tension: 0.25,
            yAxisID: "y",
            pointRadius: 3,
            pointHoverRadius: 5,
          },
          {
            label: "Embauches",
            data: data.map(d => d.hires),
            backgroundColor: "#10b981",
            borderRadius: 3,
            yAxisID: "y1",
            maxBarThickness: 18,
          },
          {
            label: "Sorties",
            data: data.map(d => d.exits),
            backgroundColor: "#dc2626",
            borderRadius: 3,
            yAxisID: "y1",
          },
          {
            type: "line",
            label: "Taux embauche %",
            data: data.map(d => d.hiresRatePct),
            borderColor: "#059669",
            backgroundColor: "rgba(5,150,105,0.18)",
            borderDash: [6,3],
            tension: 0.25,
            yAxisID: "y2",
            pointRadius: 2,
          },
          {
            type: "line",
            label: "Turnover sorties %",
            data: data.map(d => d.exitTurnoverPct),
            borderColor: "#f43f5e",
            backgroundColor: "rgba(244,63,94,0.20)",
            borderDash: [4,2],
            tension: 0.25,
            yAxisID: "y2",
            pointRadius: 2,
          }
        ]
      },
      options: {
        plugins: {
          legend: { display: true, position: 'bottom', labels:{ boxWidth:12, usePointStyle:true } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const dsLabel = ctx.dataset.label || '';
                const value = ctx.parsed.y;
                if (ctx.dataset.yAxisID === 'y2') {
                  return `${dsLabel}: ${value.toFixed(2)}%`;
                }
                return `${dsLabel}: ${value}`;
              }
            }
          }
        },
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Actifs" } },
          y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Mouvements" } },
          y2: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "%" }, ticks:{ callback: v => v + '%' }, suggestedMax: Math.max(10, Math.ceil(Math.max(...data.map(d => d.hiresRatePct||0), ...data.map(d => d.exitTurnoverPct||0)) * 1.2)) },
        },
        interaction: { mode: "index", intersect: false },
        maintainAspectRatio: false,
      }
    });
    return () => chart.destroy();
  }, [data]);

  return <canvas ref={canvasRef} height={height} />;
}
