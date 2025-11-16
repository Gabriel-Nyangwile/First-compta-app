"use client";
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function ChartFacturesAchats({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: data.map(d => d.date.toLocaleDateString()),
        datasets: [
          {
            label: "Total commandes (€)",
            data: data.map(d => d.value),
            borderColor: "#ea580c",
            backgroundColor: "rgba(234,88,12,0.1)",
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
