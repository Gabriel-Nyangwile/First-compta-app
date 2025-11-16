"use client";
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function ChartFacturesVentes({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: data.map(d => d.date.toLocaleDateString()),
        datasets: [
          {
            label: "Total facturé (€)",
            data: data.map(d => d.value),
            borderColor: "#14b8a6",
            backgroundColor: "rgba(20,184,166,0.1)",
            fill: true,
            tension: 0.2,
            pointRadius: 2
          }
        ]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { display: true },
          y: { display: true }
        }
      }
    });
    return () => chart.destroy();
  }, [data]);

  return <canvas ref={canvasRef} height={160} />;
}
