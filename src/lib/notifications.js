export async function sendInventoryCountNotification(count, stage) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  if (!count) return;

  const summary = count.summary || {};
  const deltaQty = summary.deltaQty != null ? summary.deltaQty.toFixed(3) : "0.000";
  const deltaValue =
    summary.deltaValue != null ? summary.deltaValue.toFixed(2) : "0.00";
  const countedLines = summary.countedLines ?? 0;
  const totalLines = summary.totalLines ?? 0;

  const lines = [
    `*Inventaire ${count.number}* – statut ${stage}`,
    `Lignes comptées : ${countedLines}/${totalLines}`,
    `Écart quantité : ${deltaQty}`,
    `Écart valeur : ${deltaValue} €`,
  ];
  if (count.notes) {
    lines.push(`Note : ${count.notes}`);
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: lines.join("\n"),
      }),
    });
  } catch (error) {
    console.warn("Slack notification failed", error);
  }
}
