import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// Mapeamento de código de moeda → locale para formatação
const currencyLocales = {
  BRL: "pt-BR",
  EUR: "en-IE", // Euro com símbolo antes
  USD: "en-US",
  GBP: "en-GB",
  CAD: "en-CA",
};

// Função para formatar valores
function formatarValor(valor, currency) {
  const locale = currencyLocales[currency] || "en-US";
  return Number(valor).toLocaleString(locale, { style: "currency", currency });
}

// Função para pegar nome do pagamento
function getNomePagamento(metodo) {
  if (!metodo) return "";
  switch (metodo.toLowerCase()) {
    case "pix": return "Pix";
    case "boleto": return "Boleto";
    case "credit_card":
    case "cartao":
    case "cartão":
      return "Cartão";
    default: return metodo;
  }
}

// URL fixa do Pushcut para venda aprovada
const PUSHCUT_URL = "https://api.pushcut.io/PCDbSBsyzob8kGX5YeUzr/notifications/Gringa";

// Webhook Shopify - Apenas Venda Aprovada
app.post("/shopify-aprovado", async (req, res) => {
  console.log(`[LOG] POST /shopify-aprovado recebido: ${new Date().toISOString()}`);
  try {
    console.log("[BODY]", JSON.stringify(req.body, null, 2));

    const currency = req.body.currency || "USD";
    const valorTotal = req.body.total_price || 0;
    const pagamento = getNomePagamento(req.body.payment_gateway_names?.[0] || "");

    const nomeProduto = req.body.line_items?.[0]?.name || "Produto Desconhecido";
    const valorFormatado = formatarValor(valorTotal, currency);
    const titulo = `Venda Aprovada! 🤑 ${nomeProduto}`;

    const body = {
      title: titulo,
      text: `Sua comissão: ${valorFormatado}`,
    };

    console.log("[LOG] Enviando para Pushcut:", body);
    await axios.post(PUSHCUT_URL, body);

    res.status(200).send("Pushcut enviado com sucesso!");
  } catch (err) {
    console.error("[ERRO]", err);
    res.status(500).send("Erro ao enviar Pushcut.");
  }
});

// Rota de ping (não dispara Pushcut)
app.get("/ping", (req, res) => {
  console.log(`[PING] Recebido em ${new Date().toLocaleString()}`);
  res.status(200).send("OK");
});

// Função para manter Render acordado
function manterRenderAcordado() {
  const url = "https://notipay.onrender.com/ping"; // rota nova
  setInterval(async () => {
    try {
      await axios.get(url);
      console.log(`[PING] Render acordado: ${url} (${new Date().toLocaleString()})`);
    } catch (err) {
      console.error("[PING] Falha ao acordar Render:", err.message);
    }
  }, 14 * 60 * 1000); // 14 minutos
}
manterRenderAcordado();

// Inicializa servidor (apenas uma vez)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SERVER] Rodando na porta ${PORT}`);
});