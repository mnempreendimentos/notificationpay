import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ====== Locales por moeda (fallbacks) ======
const currencyLocales = {
  BRL: "pt-BR",
  EUR: "en-IE", // Euro com símbolo antes
  USD: "en-US",
  GBP: "en-GB",
  CAD: "en-CA",
  CRC: "es-CR", // padrão do Colón (mas vamos sobrescrever p/ en-US na rota)
};

// ====== Formatador com opções ======
function formatarValor(valor, currency, opts = {}) {
  const { locale, narrow } = opts;
  const loc = locale || currencyLocales[currency] || "en-US";
  return Number(valor || 0).toLocaleString(loc, {
    style: "currency",
    currency,
    currencyDisplay: narrow ? "narrowSymbol" : "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Nome legível do método de pagamento (se precisar)
function getNomePagamento(metodo) {
  if (!metodo) return "";
  switch ((metodo || "").toLowerCase()) {
    case "pix": return "Pix";
    case "boleto": return "Boleto";
    case "credit_card":
    case "cartao":
    case "cartão":
      return "Cartão";
    default: return metodo;
  }
}

// ====== Pushcut ======
const PUSHCUT_URL = "https://api.pushcut.io/PCDbSBsyzob8kGX5YeUzr/notifications/Gringa";

async function sendPushcut({ title, text }) {
  await axios.post(PUSHCUT_URL, { title, text });
}

function getNomeProduto(body) {
  return body?.line_items?.[0]?.name || "Produto Desconhecido";
}

function getComissao(body) {
  // Use "commission" se você enviar no webhook; senão cai no total_price
  const raw = body?.commission ?? body?.total_price ?? 0;
  return Number(raw);
}

function tituloVenda(nomeProduto) {
  return `Venda Aprovada! 🤑 ${nomeProduto}`;
}

// Handler genérico p/ rotas por país
async function handleRotaPais(req, res, { flag, currency, localeOverride, narrowSymbol }) {
  try {
    console.log(`[${req.path}] payload:`, JSON.stringify(req.body, null, 2));

    const nomeProduto = getNomeProduto(req.body);
    const comissao = getComissao(req.body);

    const valorFormatado = formatarValor(comissao, currency, {
      locale: localeOverride,
      narrow: !!narrowSymbol,
    });

    const title = tituloVenda(nomeProduto);
    const text = `${flag} Sua Comissão: ${valorFormatado}`;

    await sendPushcut({ title, text });

    res.status(200).send(`OK (${req.path}) — Pushcut enviado.`);
  } catch (err) {
    console.error(`[${req.path}] ERRO:`, err);
    res.status(500).send(`Erro em ${req.path}.`);
  }
}

// ====== ROTAS PEDIDAS ======

// PANAMÁ → 🇨🇦 + $10.00 (usa USD com formatação en-US)
app.post("/panama", (req, res) =>
  handleRotaPais(req, res, {
    flag: "🇨🇦",
    currency: "USD",
    localeOverride: "en-US",
    narrowSymbol: false, // "$"
  })
);

// EL SALVADOR → 🇺🇸 + $10.00 (USD en-US)
app.post("/el-salvador", (req, res) =>
  handleRotaPais(req, res, {
    flag: "🇺🇸",
    currency: "USD",
    localeOverride: "en-US",
    narrowSymbol: false, // "$"
  })
);

// COSTA RICA → 🇨🇷 + ₡1,000.00 (CRC com estilo en-US e símbolo estreito)
app.post("/costa-rica", (req, res) =>
  handleRotaPais(req, res, {
    flag: "🇨🇷",
    currency: "CRC",
    localeOverride: "en-US", // para garantir "₡1,000.00"
    narrowSymbol: true,      // força "₡" ao invés de "CRC"
  })
);

// ====== ROTA LEGADA (mantida) ======
app.post("/shopify-aprovado", async (req, res) => {
  console.log(`[LOG] POST /shopify-aprovado: ${new Date().toISOString()}`);
  try {
    console.log("[BODY]", JSON.stringify(req.body, null, 2));

    const currency = req.body.currency || "USD";
    const valorTotal = Number(req.body.total_price || 0);
    const pagamento = getNomePagamento(req.body.payment_gateway_names?.[0] || "");

    const nomeProduto = getNomeProduto(req.body);
    const valorFormatado = formatarValor(valorTotal, currency);
    const title = tituloVenda(nomeProduto);

    const text = `Sua comissão: ${valorFormatado}${pagamento ? ` • ${pagamento}` : ""}`;

    await sendPushcut({ title, text });
    res.status(200).send("Pushcut enviado com sucesso!");
  } catch (err) {
    console.error("[ERRO]", err);
    res.status(500).send("Erro ao enviar Pushcut.");
  }
});

// ====== Ping & Keep-alive ======
app.get("/ping", (req, res) => {
  console.log(`[PING] ${new Date().toLocaleString()}`);
  res.status(200).send("OK");
});

function manterRenderAcordado() {
  const url = "https://notificationpay.onrender.com/ping";
  setInterval(async () => {
    try {
      await axios.get(url);
      console.log(`[PING] Render acordado: ${url} (${new Date().toLocaleString()})`);
    } catch (err) {
      console.error("[PING] Falha ao acordar Render:", err.message);
    }
  }, 14 * 60 * 1000); // 14 min
}
manterRenderAcordado();

// ====== Start ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SERVER] Rodando na porta ${PORT}`);
});
