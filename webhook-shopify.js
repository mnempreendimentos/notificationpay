// webhook-shopify.js
import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Moedas permitidas e símbolos
const moedasPermitidas = {
  "BRL": "R$",
  "EUR": "€",
  "USD": "$",
  "CRC": "₡",
  "GTQ": "Q",
  "HNL": "L",
  "NIO": "C$",
  "DOP": "RD$",
  "KRW": "₩"
};

// Notificar Pushcut
async function notificarPushcut(titulo, texto) {
  try {
    await axios.post("https://api.pushcut.io/PCDbSBsyzob8kGX5YeUzr/notifications/Gringa", {
      title: titulo,
      text: texto
    });
    console.log("[✅] Pushcut enviado:", titulo, texto);
  } catch (error) {
    console.error("[❌] Erro ao enviar pushcut:", error.response?.data || error.message);
  }
}

// Webhook Shopify - somente vendas pagas
app.post("/shopify-venda", async (req, res) => {
  console.log("📦 Webhook recebido:", new Date().toISOString());

  try {
    const data = req.body;
    const status = data.financial_status;
    const moeda = data.currency?.toUpperCase();
    const total = parseFloat(data.total_price);
    const produto = data.line_items?.[0]?.title || "Produto";

    // Só aceitar se estiver "paid"
    if (status !== "paid") {
      console.log("⛔ Ignorado: não pago");
      return res.status(200).send("Ignorado: status != paid");
    }

    // Só aceitar moedas da lista
    if (!moedasPermitidas[moeda]) {
      console.log(`⛔ Ignorado: moeda não permitida (${moeda})`);
      return res.status(200).send("Moeda não permitida");
    }

    const simbolo = moedasPermitidas[moeda];
    const valorFormatado = `${simbolo} ${total.toLocaleString("pt-BR")}`;

    const titulo = `Venda Aprovada! 🤑 ${produto}`;
    const texto = `Sua Comissão: ${valorFormatado}`;

    await notificarPushcut(titulo, texto);
    res.status(200).send("Notificação enviada!");

  } catch (err) {
    console.error("[ERRO]", err.message);
    res.status(500).send("Erro ao processar venda.");
  }
});

// Health check
app.get("/", (req, res) => {
  res.status(200).send("✅ Webhook ativo.");
});

// Ping automático no Render
setInterval(async () => {
  try {
    await axios.get("https://notificationpay.onrender.com/");
    console.log("[PING] Render acordado");
  } catch (err) {
    console.error("[PING FAIL]", err.message);
  }
}, 14 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
