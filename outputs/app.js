const APP_STATE_ID = "main";
const AUTH_STORAGE_KEY = "finance-system-auth-session-v1";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RECEIPT_PREVIEW_MAX_WIDTH = 900;
const RECEIPT_PREVIEW_QUALITY = 0.68;

const samples = {
  invoice: `Invoice INV-1005
Supplier: ABC Trading Sdn Bhd
Date: 2026-06-10
Product A 10 8.50 85.00
Product B 3 12.00 36.00
Total RM 121.00`,
  expense: `Receipt
Merchant: Shell Jalan Ampang
Date: 12/06/2026
Petrol RON95
Amount RM 96.40`,
  payment: `DuitNow Transfer Successful
Recipient: ABC Trading Sdn Bhd
Date: 2026-06-13
Reference No: FPX88773321
Amount Paid RM 121.00`,
  income: `Sales Receipt
Payer: Customer Lee
Date: 2026-06-14
Reference No: SALE-20260614
Amount RM 580.00`
};

const defaultState = {
  cashOnHand: 15000,
  incomes: [],
  invoices: [],
  expenses: [],
  payments: [],
  walletTransfers: [],
  incomeRules: [
    { id: "default-ibg-lazada", match: "IBG Credit", source: "Lazada" },
    { id: "default-imeps-shopee", match: "IMEPS", source: "Shopee" }
  ],
  outgoingRules: [
    { id: "default-water", match: "水费", target: "personal_expenses", name: "水费" },
    { id: "default-toll", match: "toll", target: "personal_expenses", name: "Toll" },
    { id: "default-rfid", match: "rfid", target: "personal_expenses", name: "Toll" },
    { id: "default-petrol", match: "petrol", target: "personal_expenses", name: "汽油" },
    { id: "default-fuel", match: "fuel", target: "personal_expenses", name: "汽油" },
    { id: "default-repair", match: "repair", target: "personal_expenses", name: "维修" },
    { id: "default-service", match: "service", target: "personal_expenses", name: "维修" }
  ],
  renameRules: [
    {
      id: "default-coconut-chicken",
      match: "HERBAL SOUP - COCONUT CHICKEN",
      name: "椰子鸡汤"
    }
  ],
  costCalculators: {},
  inventory: {}
};

let state = loadState();
let selectedDirection = "outgoing";
let pendingRecord = null;
let lastSaveSnapshot = null;
let settlementDraft = null;
let supabaseConfig = null;
let authSession = null;
let canSaveApiKey = true;
let lastSupabaseSaveError = "";
let selectedMonth = currentMonth();

const els = {
  cashInput: document.querySelector("#cashInput"),
  monthInput: document.querySelector("#monthInput"),
  cashMetric: document.querySelector("#cashMetric"),
  payableMetric: document.querySelector("#payableMetric"),
  spentMetric: document.querySelector("#spentMetric"),
  companyExpenseMetric: document.querySelector("#companyExpenseMetric"),
  availableMetric: document.querySelector("#availableMetric"),
  fileInput: document.querySelector("#fileInput"),
  fileLabel: document.querySelector("#fileLabel"),
  imagePreview: document.querySelector("#imagePreview"),
  emptyPreview: document.querySelector("#emptyPreview"),
  uploadStatus: document.querySelector("#uploadStatus"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  apiKeyStatus: document.querySelector("#apiKeyStatus"),
  saveApiKeyBtn: document.querySelector("#saveApiKeyBtn"),
  saveRecordBtn: document.querySelector("#saveRecordBtn"),
  undoSaveBtn: document.querySelector("#undoSaveBtn"),
  saveRecordReviewBtn: document.querySelector("#saveRecordReviewBtn"),
  undoSaveReviewBtn: document.querySelector("#undoSaveReviewBtn"),
  generatePdfBtn: document.querySelector("#generatePdfBtn"),
  repaymentMatchPanel: document.querySelector("#repaymentMatchPanel"),
  repaymentInvoiceSelect: document.querySelector("#repaymentInvoiceSelect"),
  repaymentMatchStatus: document.querySelector("#repaymentMatchStatus"),
  ocrDetails: document.querySelector("#ocrDetails"),
  ocrText: document.querySelector("#ocrText"),
  detectedType: document.querySelector("#detectedType"),
  resultBox: document.querySelector("#resultBox"),
  invoiceDialog: document.querySelector("#invoiceDialog"),
  invoiceDialogTitle: document.querySelector("#invoiceDialogTitle"),
  invoiceDialogBody: document.querySelector("#invoiceDialogBody"),
  closeInvoiceDialogBtn: document.querySelector("#closeInvoiceDialogBtn"),
  incomeRows: document.querySelector("#incomeRows"),
  invoiceRows: document.querySelector("#invoiceRows"),
  expenseRows: document.querySelector("#expenseRows"),
  walletTransferRows: document.querySelector("#walletTransferRows"),
  expensePercentRows: document.querySelector("#expensePercentRows"),
  pendingPaymentRows: document.querySelector("#pendingPaymentRows"),
  matchedPaymentRows: document.querySelector("#matchedPaymentRows"),
  inventoryRows: document.querySelector("#inventoryRows"),
  inventorySearch: document.querySelector("#inventorySearch"),
  inventorySearchStatus: document.querySelector("#inventorySearchStatus"),
  ruleMatchInput: document.querySelector("#ruleMatchInput"),
  ruleNameInput: document.querySelector("#ruleNameInput"),
  addRuleBtn: document.querySelector("#addRuleBtn"),
  renameRuleRows: document.querySelector("#renameRuleRows"),
  incomeRuleMatchInput: document.querySelector("#incomeRuleMatchInput"),
  incomeRuleSourceInput: document.querySelector("#incomeRuleSourceInput"),
  addIncomeRuleBtn: document.querySelector("#addIncomeRuleBtn"),
  incomeRuleRows: document.querySelector("#incomeRuleRows"),
  outgoingRuleMatchInput: document.querySelector("#outgoingRuleMatchInput"),
  outgoingRuleTargetInput: document.querySelector("#outgoingRuleTargetInput"),
  outgoingRuleNameInput: document.querySelector("#outgoingRuleNameInput"),
  addOutgoingRuleBtn: document.querySelector("#addOutgoingRuleBtn"),
  outgoingRuleRows: document.querySelector("#outgoingRuleRows"),
  expenseRuleMatchInput: document.querySelector("#expenseRuleMatchInput"),
  expenseRuleDisplayInput: document.querySelector("#expenseRuleDisplayInput"),
  expenseRuleNameInput: document.querySelector("#expenseRuleNameInput"),
  addExpenseRuleBtn: document.querySelector("#addExpenseRuleBtn"),
  expenseRuleRows: document.querySelector("#expenseRuleRows"),
  authEmailInput: document.querySelector("#authEmailInput"),
  authPasswordInput: document.querySelector("#authPasswordInput"),
  loginBtn: document.querySelector("#loginBtn"),
  signupBtn: document.querySelector("#signupBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  rememberLoginInput: document.querySelector("#rememberLoginInput"),
  authStatus: document.querySelector("#authStatus")
};

els.loginBtn.addEventListener("click", signInWithEmail);
els.signupBtn.addEventListener("click", signUpWithEmail);
els.logoutBtn.addEventListener("click", signOut);
document.querySelector("#analyzeBtn").addEventListener("click", analyzeCurrentDocument);
els.saveRecordBtn.addEventListener("click", savePendingRecord);
els.undoSaveBtn.addEventListener("click", undoLastSave);
els.saveRecordReviewBtn.addEventListener("click", savePendingRecord);
els.undoSaveReviewBtn.addEventListener("click", undoLastSave);
els.generatePdfBtn.addEventListener("click", generateSettlementPdf);
els.repaymentInvoiceSelect.addEventListener("change", handleRepaymentInvoiceSelection);
els.repaymentInvoiceSelect.addEventListener("change", updateManualRepaymentSaveState);
document.querySelector("#exportBtn").addEventListener("click", exportData);
document.querySelector("#resetBtn").addEventListener("click", resetData);
els.saveApiKeyBtn.addEventListener("click", saveApiKey);
els.inventorySearch.addEventListener("input", renderTables);
els.inventoryRows.addEventListener("input", handleCostCalculatorInput);
els.ruleMatchInput.addEventListener("input", renderTables);
els.addRuleBtn.addEventListener("click", addRenameRule);
els.renameRuleRows.addEventListener("click", handleRuleTableClick);
els.addIncomeRuleBtn.addEventListener("click", addIncomeRule);
els.incomeRuleRows.addEventListener("click", handleRuleTableClick);
els.addOutgoingRuleBtn.addEventListener("click", addOutgoingRule);
els.outgoingRuleRows.addEventListener("click", handleRuleTableClick);
els.addExpenseRuleBtn.addEventListener("click", addExpenseRule);
els.expenseRuleRows.addEventListener("click", handleRuleTableClick);
els.invoiceRows.addEventListener("click", handleInvoiceRowClick);
els.closeInvoiceDialogBtn.addEventListener("click", () => els.invoiceDialog.close());

document.querySelectorAll(".segment-button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedDirection = button.dataset.direction;
    document.querySelectorAll(".segment-button").forEach((item) => item.classList.toggle("active", item === button));
    updateDetectedTypeFromDirection();
    updateUploadStatusForDirection();
    updateRepaymentMatchPanel();
    updateManualRepaymentSaveState();
  });
});

els.cashInput.addEventListener("input", () => {
  state.cashOnHand = toMoney(els.cashInput.value);
  saveState();
  render();
});

els.monthInput.addEventListener("change", () => {
  selectedMonth = els.monthInput.value || currentMonth();
  render();
});

els.fileInput.addEventListener("change", () => {
  const files = selectedUploadFiles();
  if (!files.length) return;
  els.fileLabel.textContent = files.length === 1 ? files[0].name : `${files.length} 张图片：${files.map((file) => file.name).join(", ")}`;
  els.ocrText.value = "";
  els.ocrDetails.open = false;
  clearPendingRecord();
  els.resultBox.innerHTML = "<p>已上传新凭证，等待 AI/OCR 识别。</p>";
  els.uploadStatus.textContent = els.fileInput.files.length > 2
    ? "已选择超过 2 张，系统会先识别前 2 张。"
    : uploadReadyMessage();
  els.uploadStatus.className = "upload-status ready";
  if (files[0].type.startsWith("image/")) {
    els.imagePreview.src = URL.createObjectURL(files[0]);
    els.imagePreview.hidden = false;
    els.emptyPreview.hidden = true;
  } else {
    els.imagePreview.hidden = true;
    els.emptyPreview.hidden = false;
  }
});

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
});

function loadState() {
  return normalizeState(structuredClone(defaultState));
}

function normalizeState(value) {
  const expenses = Array.isArray(value?.expenses) ? value.expenses : [];
  const existingTransfers = Array.isArray(value?.walletTransfers) ? value.walletTransfers : [];
  const migratedTransfers = expenses
    .filter(isTouchNgoTransferExpense)
    .map((expense) => ({
      id: expense.id || crypto.randomUUID(),
      date: expense.date,
      payee: expense.merchant || "Touch 'n Go",
      reference: expense.note || "Migrated Touch 'n Go transfer",
      amount: expense.amount
    }));

  return {
    ...structuredClone(defaultState),
    ...value,
    incomes: Array.isArray(value?.incomes) ? value.incomes : [],
    invoices: Array.isArray(value?.invoices) ? value.invoices : [],
    expenses: expenses.filter((expense) => !isTouchNgoTransferExpense(expense)),
    payments: Array.isArray(value?.payments) ? value.payments : [],
    walletTransfers: [...existingTransfers, ...migratedTransfers],
    incomeRules: mergeDefaultRules(value?.incomeRules, defaultState.incomeRules),
    outgoingRules: mergeDefaultRules(value?.outgoingRules, defaultState.outgoingRules),
    renameRules: Array.isArray(value?.renameRules) ? value.renameRules : structuredClone(defaultState.renameRules),
    costCalculators: value?.costCalculators || {},
    inventory: value?.inventory || {}
  };
}

function isTouchNgoTransferExpense(expense) {
  return normalizeSearch(`${expense?.merchant || ""} ${expense?.category || ""}`).includes("touch")
    && normalizeSearch(`${expense?.merchant || ""} ${expense?.category || ""}`).includes("go");
}

function mergeDefaultRules(savedRules, defaultRules) {
  const existing = Array.isArray(savedRules) ? savedRules : [];
  const existingIds = new Set(existing.map((rule) => rule.id));
  return [
    ...existing,
    ...defaultRules.filter((rule) => !existingIds.has(rule.id))
  ];
}

function saveState() {
  return saveStateToSupabase();
}

async function loadStateFromSupabase() {
  try {
    await ensureSupabaseConfig();
    if (!supabaseConfig?.url || !supabaseConfig?.anonKey) {
      els.uploadStatus.textContent = "Supabase 还没连接。请设置 SUPABASE_URL 和 SUPABASE_ANON_KEY。";
      els.uploadStatus.className = "upload-status warning";
      return;
    }
    if (!authSession?.access_token) {
      updateAuthUi();
      state = normalizeState(structuredClone(defaultState));
      render();
      els.uploadStatus.textContent = "请先用 Email 登录，系统才会载入 Supabase 资料。";
      els.uploadStatus.className = "upload-status warning";
      return;
    }

    const [appRows, invoiceRows, inventoryRows] = await Promise.all([
      supabaseRequest(`/app_state?id=eq.${encodeURIComponent(appStateId())}&select=data`),
      supabaseRequest("/invoices?select=*"),
      supabaseRequest("/inventory?select=*")
    ]);

    const baseState = appRows?.[0]?.data || structuredClone(defaultState);
    state = normalizeState({
      ...baseState,
      invoices: Array.isArray(invoiceRows) ? invoiceRows.map(invoiceFromRow) : [],
      inventory: inventoryFromRows(inventoryRows)
    });
    fixKnownUnknownSuppliers();
    rebuildInventoryFromInvoices();
    reapplyIncomeRules();
    reapplyExpenseRules();
    render();
    els.uploadStatus.textContent = "Supabase 数据库资料已载入。";
    els.uploadStatus.className = "upload-status ready";
  } catch (error) {
    els.uploadStatus.textContent = `Supabase 读取失败：${error.message || "请检查环境变量和 Supabase table。"}`;
    els.uploadStatus.className = "upload-status warning";
    setAuthWarning(error.message || "Supabase 读取失败。");
  }
}

async function saveStateToSupabase() {
  try {
    lastSupabaseSaveError = "";
    await ensureSupabaseConfig();
    if (!supabaseConfig?.url || !supabaseConfig?.anonKey) return false;
    if (!authSession?.access_token) {
      els.uploadStatus.textContent = "请先登录，资料才会保存到 Supabase。";
      els.uploadStatus.className = "upload-status warning";
      return false;
    }
    await replaceSupabaseTable("suppliers", supplierRowsFromState());
    await replaceSupabaseTable("invoices", state.invoices.map(invoiceToRow));
    await replaceSupabaseTable("inventory", inventoryRowsFromState());
    await upsertSupabaseRows("app_state", [withUserId({ id: appStateId(), data: appStatePayload() })]);
    return true;
  } catch (error) {
    lastSupabaseSaveError = error.message || "未知 Supabase 保存错误。";
    els.uploadStatus.textContent = `Supabase 保存失败：${error.message || "请检查网络、URL、ANON KEY 和 RLS policy。"}`;
    els.uploadStatus.className = "upload-status warning";
    return false;
  }
}

async function ensureSupabaseConfig() {
  if (supabaseConfig) return supabaseConfig;
  const response = await fetch("/api/supabase-config");
  supabaseConfig = await readJsonResponse(response, "/api/supabase-config");
  if (!supabaseConfig?.url || !supabaseConfig?.anonKey) {
    throw new Error("/api/supabase-config 没有回传 SUPABASE_URL 或 SUPABASE_ANON_KEY。请检查 .env 和 Vercel 环境变量。");
  }
  return supabaseConfig;
}

async function authRequest(path, body) {
  await ensureSupabaseConfig();
  const response = await fetch(`${supabaseConfig.url}/auth/v1${path}`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await readJsonResponse(response, `Supabase Auth ${path}`);
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || "Supabase Auth 请求失败。");
  return payload;
}

async function signInWithEmail() {
  const credentials = authCredentials();
  if (!credentials) return;
  setAuthBusy(true);
  try {
    const payload = await authRequest("/token?grant_type=password", credentials);
    setAuthSession(payload, { persist: els.rememberLoginInput.checked });
    await loadStateFromSupabase();
  } catch (error) {
    setAuthWarning(loginErrorMessage(error));
  } finally {
    setAuthBusy(false);
  }
}

async function signUpWithEmail() {
  const credentials = authCredentials();
  if (!credentials) return;
  setAuthBusy(true);
  try {
    const payload = await authRequest("/signup", credentials);
    if (payload.access_token) {
      setAuthSession(payload, { persist: els.rememberLoginInput.checked });
      await loadStateFromSupabase();
    } else {
      setAuthReady("注册成功。请去 Email 信箱确认账号，然后回到这里登录。");
    }
  } catch (error) {
    setAuthWarning(signupErrorMessage(error));
  } finally {
    setAuthBusy(false);
  }
}

function signOut() {
  authSession = null;
  clearPersistedAuthSession();
  state = normalizeState(structuredClone(defaultState));
  clearPendingRecord();
  render();
  updateAuthUi();
  els.uploadStatus.textContent = "已退出登录。";
  els.uploadStatus.className = "upload-status warning";
}

function authCredentials() {
  const email = els.authEmailInput.value.trim();
  const password = els.authPasswordInput.value;
  if (!email || !password) {
    setAuthWarning("请填写 Email 和 Password。");
    return null;
  }
  if (password.length < 6) {
    setAuthWarning("Password 至少需要 6 个字符。");
    return null;
  }
  return { email, password };
}

function setAuthSession(payload, options = {}) {
  authSession = normalizeAuthSession(payload);
  els.authPasswordInput.value = "";
  if (authSession?.user?.email) els.authEmailInput.value = authSession.user.email;
  if (options.persist) savePersistedAuthSession(authSession);
  updateAuthUi();
}

function updateAuthUi() {
  const loggedIn = Boolean(authSession?.access_token);
  document.body.classList.toggle("is-authenticated", loggedIn);
  els.loginBtn.hidden = loggedIn;
  els.signupBtn.hidden = loggedIn;
  els.logoutBtn.hidden = !loggedIn;
  els.authEmailInput.disabled = loggedIn;
  els.authPasswordInput.hidden = loggedIn;
  els.rememberLoginInput.closest(".remember-login").hidden = loggedIn;
  if (loggedIn) {
    setAuthReady(`已登录：${authSession.user?.email || els.authEmailInput.value.trim()}`);
  } else {
    setAuthWarning("请先登录以载入数据库资料。");
  }
}

function setAuthBusy(isBusy) {
  els.loginBtn.disabled = isBusy;
  els.signupBtn.disabled = isBusy;
  els.logoutBtn.disabled = isBusy;
}

function setAuthReady(message) {
  els.authStatus.textContent = message;
  els.authStatus.className = "ready";
}

function setAuthWarning(message) {
  els.authStatus.textContent = message;
  els.authStatus.className = "warning";
}

function loginErrorMessage(error) {
  const message = String(error?.message || "");
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "登录失败：Email 或 Password 不正确。如果还没有账号，请先按“注册”。如果刚注册，请先去 Email 信箱确认账号。";
  }
  if (normalized.includes("email not confirmed")) {
    return "登录失败：这个 Email 还没确认。请去信箱点击 Supabase confirmation link 后再登录。";
  }
  return message || "登录失败，请检查 Email 和 Password。";
}

function signupErrorMessage(error) {
  const message = String(error?.message || "");
  const normalized = message.toLowerCase();
  if (normalized.includes("already registered") || normalized.includes("user already registered")) {
    return "这个 Email 已经注册过了，请直接按“登录”。如果忘记密码，需要在 Supabase Auth 重设密码。";
  }
  if (normalized.includes("password")) {
    return "注册失败：Password 至少需要 6 个字符，建议用比较长的密码。";
  }
  return message || "注册失败，请检查 Email、Password 或 Supabase Auth 设置。";
}

function normalizeAuthSession(payload) {
  if (!payload) return null;
  const expiresAt = payload.expires_at
    ? Number(payload.expires_at) * 1000
    : Date.now() + Number(payload.expires_in || 3600) * 1000;
  return {
    ...payload,
    expires_at_ms: expiresAt
  };
}

function savePersistedAuthSession(session) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      session,
      rememberUntil: Date.now() + THIRTY_DAYS_MS
    }));
  } catch {
    setAuthWarning("浏览器无法保存登录状态。");
  }
}

function clearPersistedAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

async function restorePersistedAuthSession() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    clearPersistedAuthSession();
    return false;
  }
  if (!saved?.session || !saved?.rememberUntil) return false;
  if (Date.now() > Number(saved.rememberUntil)) {
    clearPersistedAuthSession();
    return false;
  }

  const savedSession = normalizeAuthSession(saved.session);
  if (savedSession?.access_token && Date.now() < savedSession.expires_at_ms - 60_000) {
    setAuthSession(savedSession);
    els.rememberLoginInput.checked = true;
    return true;
  }

  if (!savedSession?.refresh_token) {
    clearPersistedAuthSession();
    return false;
  }

  try {
    setAuthWarning("正在恢复登录...");
    const refreshed = await authRequest("/token?grant_type=refresh_token", {
      refresh_token: savedSession.refresh_token
    });
    setAuthSession(refreshed, { persist: true });
    els.rememberLoginInput.checked = true;
    return true;
  } catch {
    clearPersistedAuthSession();
    setAuthWarning("登录已过期，请重新登录。");
    return false;
  }
}

async function supabaseRequest(path, options = {}) {
  await ensureSupabaseConfig();
  const method = options.method || "GET";
  const response = await fetchWithRetry("/api/supabase-rest", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authSession?.access_token || supabaseConfig.anonKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      path,
      method,
      headers: options.headers || {},
      body: options.body || null
    })
  }, `Supabase REST ${method} ${path}`);
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return null;
  return readJsonResponse(response, `Supabase REST ${path}`, { allowEmpty: true });
}

async function fetchWithRetry(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(450 * attempt);
    }
  }
  throw new Error(`${label} 连接失败：${lastError?.message || "Load failed"}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonResponse(response, label, options = {}) {
  const text = await response.text();
  if (!text.trim() && options.allowEmpty) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${label} 回传的不是 JSON：${summarizeClientText(text)}`);
  }
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new Error(`${label} 回传了无法解析的 JSON：${summarizeClientText(text)}`);
  }
}

function summarizeClientText(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "空内容";
}

async function replaceSupabaseTable(table, rows) {
  await supabaseRequest(`/${table}?id=neq.__never__`, { method: "DELETE" });
  if (rows.length) await upsertSupabaseRows(table, rows);
}

async function upsertSupabaseRows(table, rows) {
  return supabaseRequest(`/${table}?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows)
  });
}

function appStatePayload() {
  const { invoices, inventory, ...rest } = state;
  return rest;
}

function supplierRowsFromState() {
  const names = new Set(state.invoices.map((invoice) => invoice.supplier).filter(Boolean));
  Object.values(state.inventory || {}).forEach((item) => {
    if (item.supplier) names.add(item.supplier);
  });
  return [...names].map((name) => ({
    id: supplierId(name),
    name,
    normalized_name: normalizeSearch(name),
    updated_at: new Date().toISOString()
  })).map(withUserId);
}

function invoiceToRow(invoice) {
  const receiptImages = invoice.receiptImages || (invoice.receiptImage ? [invoice.receiptImage] : []);
  return withUserId({
    id: invoice.id || crypto.randomUUID(),
    supplier_id: supplierId(invoice.supplier),
    supplier_name: invoice.supplier || "Unknown Supplier",
    invoice_no: invoice.invoiceNo || "",
    invoice_date: invoice.date || null,
    total: Number(invoice.total || 0),
    paid: Number(invoice.paid || 0),
    status: invoice.status || "Unpaid",
    items: invoice.items || [],
    receipt_images: receiptImages.map(limitReceiptPreview),
    receipt_file_names: invoice.receiptFileNames || (invoice.receiptFileName ? [invoice.receiptFileName] : []),
    settlement_statement: invoice.settlementStatement || null,
    metadata: invoiceMetadataForSupabase(invoice),
    updated_at: new Date().toISOString()
  });
}

function invoiceFromRow(row) {
  return {
    ...(row.metadata || {}),
    id: row.id,
    type: "supplier_invoice",
    supplier: row.supplier_name,
    invoiceNo: row.invoice_no,
    date: row.invoice_date,
    total: Number(row.total || 0),
    paid: Number(row.paid || 0),
    status: row.status || "Unpaid",
    items: row.items || [],
    receiptImages: row.receipt_images || [],
    receiptFileNames: row.receipt_file_names || [],
    settlementStatement: row.settlement_statement || row.metadata?.settlementStatement
  };
}

function inventoryRowsFromState() {
  return Object.entries(state.inventory || {}).map(([key, item]) => withUserId({
    id: scopedRecordId(key || item.product || "unknown-product"),
    product: item.product,
    latest_cost: Number(item.latestCost || 0),
    invoice_date: item.invoiceDate || null,
    supplier_id: supplierId(item.supplier),
    supplier_name: item.supplier || "",
    metadata: { ...item, inventoryKey: key },
    updated_at: new Date().toISOString()
  }));
}

function inventoryFromRows(rows) {
  return Array.isArray(rows) ? rows.reduce((inventory, row) => {
    const key = row.metadata?.inventoryKey || unscopedRecordId(row.id);
    inventory[key] = {
      ...(row.metadata || {}),
      product: row.product,
      latestCost: Number(row.latest_cost || 0),
      invoiceDate: row.invoice_date,
      supplier: row.supplier_name
    };
    return inventory;
  }, {}) : {};
}

function supplierId(name) {
  return scopedRecordId(name || "unknown-supplier");
}

function scopedRecordId(value) {
  const slug = normalizeSearch(value || "record").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "record";
  return `${currentUserPrefix()}-${slug}`;
}

function unscopedRecordId(value) {
  const prefix = `${currentUserPrefix()}-`;
  return String(value || "").startsWith(prefix) ? String(value).slice(prefix.length) : value;
}

function currentUserPrefix() {
  return authSession?.user?.id || "anonymous";
}

function appStateId() {
  return `${currentUserPrefix()}-${APP_STATE_ID}`;
}

function withUserId(row) {
  return {
    ...row,
    user_id: authSession?.user?.id
  };
}

function addRenameRule() {
  const match = els.ruleMatchInput.value.trim();
  const name = els.ruleNameInput.value.trim();

  if (!match || !name) {
    els.uploadStatus.textContent = "请填写 OCR 字眼和要改成的产品名。";
    els.uploadStatus.className = "upload-status warning";
    return;
  }

  state.renameRules.push({
    id: crypto.randomUUID(),
    match,
    name
  });
  els.ruleMatchInput.value = "";
  els.ruleNameInput.value = "";
  saveState();
  rebuildInventoryFromInvoices();
  render();
  els.uploadStatus.textContent = "产品命名规则已保存。";
  els.uploadStatus.className = "upload-status ready";
}

function handleRuleTableClick(event) {
  const renameButton = event.target.closest("[data-delete-rule]");
  const incomeButton = event.target.closest("[data-delete-income-rule]");
  const outgoingButton = event.target.closest("[data-delete-outgoing-rule]");
  const expenseButton = event.target.closest("[data-delete-expense-rule]");
  if (renameButton) state.renameRules = state.renameRules.filter((rule) => rule.id !== renameButton.dataset.deleteRule);
  if (incomeButton) state.incomeRules = state.incomeRules.filter((rule) => rule.id !== incomeButton.dataset.deleteIncomeRule);
  if (outgoingButton) state.outgoingRules = state.outgoingRules.filter((rule) => rule.id !== outgoingButton.dataset.deleteOutgoingRule);
  if (expenseButton) state.outgoingRules = state.outgoingRules.filter((rule) => rule.id !== expenseButton.dataset.deleteExpenseRule);
  if (!renameButton && !incomeButton && !outgoingButton && !expenseButton) return;
  if (incomeButton) reapplyIncomeRules();
  if (expenseButton) reapplyExpenseRules();
  saveState();
  rebuildInventoryFromInvoices();
  render();
}

function addIncomeRule() {
  const match = els.incomeRuleMatchInput.value.trim();
  const source = els.incomeRuleSourceInput.value.trim();
  if (!match || !source) {
    setRuleWarning("请填写进账字眼和来源。");
    return;
  }
  state.incomeRules.push({ id: crypto.randomUUID(), match, source });
  els.incomeRuleMatchInput.value = "";
  els.incomeRuleSourceInput.value = "";
  reapplyIncomeRules();
  saveState();
  render();
  setRuleSaved("进账来源规则已保存。");
}

function addOutgoingRule() {
  const match = els.outgoingRuleMatchInput.value.trim();
  const target = els.outgoingRuleTargetInput.value;
  const name = els.outgoingRuleNameInput.value.trim();
  if (!match || !name) {
    setRuleWarning("请填写出账字眼和名称 / 分类。");
    return;
  }
  state.outgoingRules.push({ id: crypto.randomUUID(), match, target, name });
  els.outgoingRuleMatchInput.value = "";
  els.outgoingRuleNameInput.value = "";
  saveState();
  render();
  setRuleSaved("出账分类规则已保存。");
}

function addExpenseRule() {
  const match = els.expenseRuleMatchInput.value.trim();
  const displayName = els.expenseRuleDisplayInput.value.trim();
  const category = els.expenseRuleNameInput.value.trim();
  if (!match || !displayName || !category) {
    setRuleWarning("请填写个人支出字眼、新规则和分类名称。");
    return;
  }
  state.outgoingRules.push({
    id: crypto.randomUUID(),
    match,
    target: "personal_expenses",
    displayName,
    name: category
  });
  els.expenseRuleMatchInput.value = "";
  els.expenseRuleDisplayInput.value = "";
  els.expenseRuleNameInput.value = "";
  reapplyExpenseRules();
  saveState();
  render();
  setRuleSaved("个人支出分类规则已保存。");
}

function setRuleWarning(message) {
  els.uploadStatus.textContent = message;
  els.uploadStatus.className = "upload-status warning";
}

function setRuleSaved(message) {
  els.uploadStatus.textContent = message;
  els.uploadStatus.className = "upload-status ready";
}

async function refreshConfigStatus() {
  try {
    const configResponse = await fetch("/api/config");
    const config = await readJsonResponse(configResponse, "/api/config");
    canSaveApiKey = config.canSaveApiKey !== false;
    els.saveApiKeyBtn.disabled = !canSaveApiKey;
    els.apiKeyInput.disabled = !canSaveApiKey;
    els.apiKeyStatus.textContent = config.hasApiKey
      ? `OCR 已连接，模型：${config.model}`
      : canSaveApiKey
        ? "还没有保存 OpenAI API Key。"
        : "线上 Vercel 还没有设置 OPENAI_API_KEY。请去 Vercel Project Settings > Environment Variables 添加后重新部署。";
    els.apiKeyStatus.className = config.hasApiKey ? "ready" : "warning";
  } catch (error) {
    els.apiKeyStatus.textContent = `无法连接 OCR 后端：${error.message || "请检查 API route。"}`;
    els.apiKeyStatus.className = "warning";
  }
}

async function saveApiKey() {
  if (!canSaveApiKey) {
    els.apiKeyStatus.textContent = "线上 Vercel 不能从网页保存 OpenAI API Key。请在 Vercel Environment Variables 设置 OPENAI_API_KEY 后重新部署。";
    els.apiKeyStatus.className = "warning";
    return;
  }
  const apiKey = els.apiKeyInput.value.trim();
  if (!apiKey) {
    els.apiKeyStatus.textContent = "请先粘贴 OpenAI API Key。";
    els.apiKeyStatus.className = "warning";
    return;
  }

  try {
    els.saveApiKeyBtn.disabled = true;
    els.apiKeyStatus.textContent = "正在保存 Key...";
    els.apiKeyStatus.className = "";
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, model: "gpt-5.5" })
    });
    const payload = await readJsonResponse(response, "/api/config");
    if (!response.ok) throw new Error(payload.error || "保存失败。");
    els.apiKeyInput.value = "";
    els.apiKeyStatus.textContent = `Key 已保存，OCR 已连接，模型：${payload.model}`;
    els.apiKeyStatus.className = "ready";
  } catch (error) {
    els.apiKeyStatus.textContent = error.message;
    els.apiKeyStatus.className = "warning";
  } finally {
    els.saveApiKeyBtn.disabled = false;
  }
}

function setSample(type) {
  els.ocrText.value = samples[type];
  if (type === "income") setDirection("income");
  if (type === "invoice") setDirection("outgoing");
  if (type === "payment") {
    els.detectedType.textContent = typeLabel(parseDocument(samples[type], "auto").type);
    return;
  }
  els.detectedType.textContent = typeLabel(type === "income" ? "income" : parseDocument(samples[type], selectedDirection).type);
}

function setDirection(direction) {
  selectedDirection = direction;
  document.querySelectorAll(".segment-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.direction === direction);
  });
  updateDetectedTypeFromDirection();
  updateRepaymentMatchPanel();
}

function updateDetectedTypeFromDirection() {
  els.detectedType.textContent = ({
    income: "进账",
    outgoing: "出账 Supplier Invoice",
    repayment: "还账 Payment Proof",
    expense: "个人支出",
    settlement: "对账 PDF"
  })[selectedDirection] || "等待识别";
}

function updateUploadStatusForDirection() {
  if (!selectedUploadFiles().length) return;
  els.uploadStatus.textContent = uploadReadyMessage();
  els.uploadStatus.className = "upload-status ready";
}

function uploadReadyMessage() {
  if (selectedDirection === "outgoing") return "已选择出账。识别后请按保存记录，才会进入待付款并更新 Inventory。";
  if (selectedDirection === "repayment") return "已选择还账。识别后请按保存记录，才会记录付款并匹配未付款 Invoice。";
  if (selectedDirection === "expense") return "已选择个人支出。识别后请按保存记录，才会进入个人支出并更新分类百分比。";
  if (selectedDirection === "settlement") return "已选择对账 PDF。识别后可生成双方拿货和欠款金额的 PDF。";
  return "已选择进账。识别后请按保存记录，才会加入进账记录并增加账上余额。";
}

function seedDemoData() {
  state = structuredClone(defaultState);
  recordParsedDocument(parseDocument(samples.invoice, "outgoing"));
  recordParsedDocument(parseDocument(samples.income, "income"));
  recordParsedDocument(parseDocument(samples.expense, "auto"));
  recordParsedDocument(parseDocument(samples.payment, "auto"));
  saveState();
  render();
}

function resetData() {
  state = structuredClone(defaultState);
  lastSaveSnapshot = null;
  setUndoButtonsVisible(false);
  saveState();
  els.ocrText.value = "";
  els.ocrDetails.open = false;
  els.uploadStatus.textContent = "上传后请选择进账、出账或还账，再按识别。";
  els.uploadStatus.className = "upload-status";
  els.resultBox.innerHTML = "<p>暂无识别结果</p>";
  clearPendingRecord();
  setDirection("outgoing");
  render();
}

function exportData() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `finance-inventory-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function analyzeCurrentDocument() {
  const hasFile = Boolean(selectedUploadFiles().length);
  if (hasFile) {
    await recognizeUploadedFile();
    return;
  }

  const text = els.ocrText.value.trim();
  if (!text) {
    els.ocrDetails.open = true;
    els.uploadStatus.textContent = "请先上传凭证，或贴入 OCR 原文。";
    els.uploadStatus.className = "upload-status warning";
    els.resultBox.innerHTML = `
      <div class="notice-box">
        <strong>还没有可识别的资料</strong>
        <p>请上传凭证照片，或在左侧 OCR 原文里贴入识别文字。</p>
      </div>`;
    return;
  }

  const parsed = applyTransactionRules(parseDocument(text, selectedDirection), text);
  setPendingRecord(parsed);
  renderResult(parsed);
  els.uploadStatus.textContent = "识别完成。请检查资料，然后按保存记录。";
  els.uploadStatus.className = "upload-status ready";
  showDuplicateDetectedNotice(parsed);
}

async function recognizeUploadedFile() {
  const files = selectedUploadFiles();
  const analyzeBtn = document.querySelector("#analyzeBtn");
  const originalText = analyzeBtn.textContent;

  try {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "AI 识别中...";
    els.uploadStatus.textContent = "正在用 AI/OCR 读取图片，请等一下。";
    els.uploadStatus.className = "upload-status ready";
    els.resultBox.innerHTML = "<p>AI/OCR 正在读取凭证...</p>";

    const formData = new FormData();
    files.forEach((file) => formData.append("file", file));
    formData.append("direction", selectedDirection);

    const response = await fetch("/api/ocr", {
      method: "POST",
      body: formData
    });
    const payload = await readJsonResponse(response, "/api/ocr");

    if (!response.ok) {
      throw new Error(payload.error || "OCR 识别失败。");
    }

    const parsed = applyTransactionRules(normalizeOcrPayload(payload), payload.rawText || JSON.stringify(payload));
    if (parsed.type === "settlement_statement") {
      settlementDraft = parsed;
      setPendingRecord(parsed);
      renderResult(parsed);
      els.ocrDetails.open = true;
      els.ocrText.value = payload.rawText || JSON.stringify(payload, null, 2);
      els.generatePdfBtn.hidden = false;
      els.uploadStatus.textContent = "对账资料已识别。可按保存记录进入待付款，也可以生成 PDF。";
      els.uploadStatus.className = "upload-status ready";
      showDuplicateDetectedNotice(parsed);
      return;
    }
    if (parsed.type === "supplier_invoice") {
      const receiptImages = await Promise.all(files.map(fileToReceiptPreviewDataUrl));
      parsed.receiptImages = receiptImages;
      parsed.receiptFileNames = files.map((file) => file.name);
      parsed.receiptImage = receiptImages[0];
      parsed.receiptFileName = files[0].name;
    }
    els.ocrDetails.open = true;
    els.ocrText.value = payload.rawText || JSON.stringify(payload, null, 2);
    setPendingRecord(parsed);
    renderResult(parsed);
    els.uploadStatus.textContent = "AI/OCR 已完成。请检查资料，然后按保存记录。";
    els.uploadStatus.className = "upload-status ready";
    showDuplicateDetectedNotice(parsed);
  } catch (error) {
    els.uploadStatus.textContent = "AI/OCR 识别失败。";
    els.uploadStatus.className = "upload-status warning";
    els.resultBox.innerHTML = `
      <div class="notice-box">
        <strong>AI/OCR 识别失败</strong>
        <p>${escapeHtml(error.message)}</p>
        <p>这次没有保存任何资料。请处理 API 额度或 billing 后再上传；也可以先不上传照片，只把 OCR 文字贴到左侧原文区测试。</p>
      </div>`;
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = originalText;
  }
}

function selectedUploadFiles() {
  return Array.from(els.fileInput.files || []).slice(0, 2);
}

function setPendingRecord(parsed) {
  pendingRecord = parsed;
  setSaveButtonsVisible(true);
  updateRepaymentMatchPanel();
}

function clearPendingRecord() {
  pendingRecord = null;
  setSaveButtonsVisible(false);
  updateRepaymentMatchPanel();
}

function showDuplicateDetectedNotice(record) {
  const duplicate = findDuplicateSavedRecord(structuredClone(record));
  if (!duplicate) return;
  els.detectedType.textContent = "重复凭证";
  els.uploadStatus.textContent = "这个凭证已经保存过了。";
  els.uploadStatus.className = "upload-status warning";
  els.resultBox.insertAdjacentHTML("afterbegin", `
    <div class="notice-box">
      <strong>这个凭证已经保存过了</strong>
      <p>${escapeHtml(duplicate.message)}</p>
    </div>`);
}

async function savePendingRecord() {
  const backupRecord = pendingRecord || readRecordFromRenderedResult() || buildManualRepaymentRecord();
  if (!backupRecord) {
    setSaveButtonsVisible(false);
    els.uploadStatus.textContent = "没有可保存的识别资料。请重新按一次识别。";
    els.uploadStatus.className = "upload-status warning";
    els.resultBox.innerHTML = `
      <div class="notice-box">
        <strong>还没有可保存的资料</strong>
        <p>请重新按“识别”，看到结果后再按“保存记录”。</p>
      </div>`;
    return;
  }
  pendingRecord = backupRecord;
  const record = structuredClone(pendingRecord);
  applySelectedRepaymentInvoice(record);
  if (record.type === "payment_proof" && (!record.amount || record.amount <= 0)) {
    els.uploadStatus.textContent = "还账金额是 0。请选择要还的 Invoice，系统会自动用剩余未付金额。";
    els.uploadStatus.className = "upload-status warning";
    return;
  }
  const duplicate = findDuplicateSavedRecord(record);
  if (duplicate) {
    els.detectedType.textContent = "重复凭证";
    els.uploadStatus.textContent = "这个凭证已经保存过了。";
    els.uploadStatus.className = "upload-status warning";
    els.resultBox.innerHTML = `
      <div class="notice-box">
        <strong>这个凭证已经保存过了</strong>
        <p>${escapeHtml(duplicate.message)}</p>
        <p>系统没有重复写入 Supabase，所以金额不会被计算两次。</p>
    </div>`;
    return;
  }
  lastSaveSnapshot = structuredClone(state);
  recordParsedDocument(record);
  render();
  setSaveButtonsBusy(true);
  els.uploadStatus.textContent = "正在保存到 Supabase...";
  els.uploadStatus.className = "upload-status ready";
  const persisted = await saveState();
  setSaveButtonsBusy(false);
  if (!persisted) {
    state = structuredClone(lastSaveSnapshot);
    lastSaveSnapshot = null;
    render();
    setUndoButtonsVisible(false);
    els.resultBox.innerHTML = `
      <div class="notice-box">
        <strong>保存失败</strong>
        <p>这笔记录没有写入 Supabase，所以其他手机或电脑不会看到。请检查网络、登录状态和 Supabase RLS policy。</p>
        <p><strong>Supabase 错误：</strong>${escapeHtml(lastSupabaseSaveError || "没有收到详细错误。")}</p>
      </div>`;
    return;
  }
  clearPendingRecord();
  setUndoButtonsVisible(true);
  activateTab(record.type === "supplier_invoice" || record.type === "settlement_statement" ? "invoices" : ["income", "transaction_batch"].includes(record.type) ? "incomes" : record.type === "payment_proof" ? "payments" : "expenses");
  els.detectedType.textContent = "已保存";
  els.resultBox.innerHTML = `
    <div class="notice-box success">
      <strong>记录已保存到 Supabase</strong>
      <p>${typeLabel(record.type)} 已经进入下面的记录表。其他设备用同一个 Email 登录后刷新就会看到。</p>
    </div>`;
  els.uploadStatus.textContent = "记录已保存到 Supabase。";
  els.uploadStatus.className = "upload-status ready";
}

function readRecordFromRenderedResult() {
  const summary = Object.fromEntries([...els.resultBox.querySelectorAll(".summary-item")].map((item) => [
    item.querySelector("span")?.textContent?.trim() || "",
    item.querySelector("strong")?.textContent?.trim() || ""
  ]));
  const type = readRenderedType();
  if (!type) return null;

  if (type === "supplier_invoice") {
    const items = [...els.resultBox.querySelectorAll(".line-items tbody tr")].map((row) => {
      const cells = [...row.children].map((cell) => cell.textContent.trim());
      if (cells.length < 4) return null;
      return {
        product: cells[0],
        qty: Number(cells[1]) || 0,
        unitPrice: parseRenderedMoney(cells[2]),
        total: parseRenderedMoney(cells[3])
      };
    }).filter(Boolean);

    const supplier = summary["Supplier 名字"];
    const invoiceNo = summary["Invoice 编号"];
    const total = parseRenderedMoney(summary["总金额"]);
    if (!supplier || !invoiceNo || !total) return null;

    return {
      type: "supplier_invoice",
      supplier,
      invoiceNo,
      date: summary["日期"] || new Date().toISOString().slice(0, 10),
      total,
      paid: parseRenderedMoney(summary["已付款"]),
      status: summary["状态"] || "Unpaid",
      receiptFileName: summary["单据照片"] || "",
      receiptFileNames: summary["单据照片"] ? summary["单据照片"].split(",").map((name) => name.trim()).filter(Boolean) : [],
      items
    };
  }

  if (type === "income") {
    return {
      type: "income",
      payer: summary["付款人"] || "-",
      date: summary["日期"] || new Date().toISOString().slice(0, 10),
      reference: summary["Reference Number"] || "-",
      amount: parseRenderedMoney(summary["金额"])
    };
  }

  if (type === "personal_expenses") {
    return {
      type: "personal_expenses",
      merchant: summary["商家名称"] || "-",
      date: summary["日期"] || new Date().toISOString().slice(0, 10),
      category: summary["分类"] || "其他",
      amount: parseRenderedMoney(summary["金额"])
    };
  }

  if (type === "payment_proof") {
    return {
      type: "payment_proof",
      recipient: summary["收款人"] || "-",
      date: summary["日期"] || new Date().toISOString().slice(0, 10),
      reference: summary["Reference Number"] || "-",
      amount: parseRenderedMoney(summary["金额"]),
      matchedInvoiceId: null
    };
  }

  if (type === "settlement_statement") {
    const myCompany = summary["我的公司"] || "Snackfactorie Enterprise";
    const otherCompany = summary["对方公司"] || "Pasar Mini Zai Hin";
    const date = summary["日期"] || new Date().toISOString().slice(0, 10);
    const owedAmount = parseRenderedMoney(summary["欠款金额"]);
    if (!owedAmount) return null;
    return {
      type: "settlement_statement",
      date,
      myCompany,
      otherCompany,
      myItems: [],
      otherItems: [],
      myTotal: 0,
      otherTotal: 0,
      owedAmount,
      notes: ""
    };
  }

  return null;
}

function readRenderedType() {
  const text = els.detectedType.textContent.trim();
  if (text.includes("Supplier Invoice")) return "supplier_invoice";
  if (text.includes("个人支出")) return "personal_expenses";
  if (text.includes("Payment Proof")) return "payment_proof";
  if (text.includes("对账 PDF")) return "settlement_statement";
  if (text.includes("进账")) return "income";
  return null;
}

function parseRenderedMoney(value) {
  const number = String(value || "").replace(/[^\d.-]/g, "");
  return toMoney(number || 0);
}

async function undoLastSave() {
  if (!lastSaveSnapshot) return;
  const currentSnapshot = structuredClone(state);
  state = structuredClone(lastSaveSnapshot);
  lastSaveSnapshot = null;
  render();
  const persisted = await saveState();
  if (!persisted) {
    state = currentSnapshot;
    render();
    els.uploadStatus.textContent = "撤销失败：Supabase 没有保存成功，资料已恢复到撤销前。";
    els.uploadStatus.className = "upload-status warning";
    return;
  }
  updateRepaymentMatchPanel();
  setUndoButtonsVisible(false);
  els.uploadStatus.textContent = "已撤销上一次保存，并同步到 Supabase。";
  els.uploadStatus.className = "upload-status ready";
}

function setSaveButtonsVisible(isVisible) {
  els.saveRecordBtn.hidden = !isVisible;
  els.saveRecordReviewBtn.hidden = !isVisible;
}

function setSaveButtonsBusy(isBusy) {
  els.saveRecordBtn.disabled = isBusy;
  els.saveRecordReviewBtn.disabled = isBusy;
}

function setUndoButtonsVisible(isVisible) {
  els.undoSaveBtn.hidden = !isVisible;
  els.undoSaveReviewBtn.hidden = !isVisible;
}

function activateTab(tabId) {
  document.querySelectorAll(".tab-button, .tab-panel").forEach((el) => el.classList.remove("active"));
  document.querySelector(`.tab-button[data-tab="${tabId}"]`)?.classList.add("active");
  document.querySelector(`#${tabId}`)?.classList.add("active");
}

function handleRepaymentInvoiceSelection() {
  updateManualRepaymentSaveState();
  if (!pendingRecord || pendingRecord.type !== "payment_proof") return;
  applySelectedRepaymentInvoice(pendingRecord);
  renderResult(pendingRecord);
}

function applySelectedRepaymentInvoice(record) {
  if (record.type !== "payment_proof") return;
  const selectedInvoiceId = els.repaymentInvoiceSelect.value;
  if (selectedInvoiceId === "__auto__") {
    record.matchedInvoiceId = null;
    return;
  }
  const invoice = state.invoices.find((item) => item.id === selectedInvoiceId);
  if (!invoice) return;
  const remaining = invoiceRemaining(invoice);
  record.matchedInvoiceId = invoice.id;
  record.recipient = invoice.supplier;
  if (!record.amount || record.amount <= 0) {
    record.amount = remaining;
  }
  if (!record.reference || record.reference === "-") {
    record.reference = `Manual repayment - ${invoice.invoiceNo}`;
  }
}

function updateRepaymentMatchPanel() {
  const isRepayment = selectedDirection === "repayment" || pendingRecord?.type === "payment_proof";
  els.repaymentMatchPanel.hidden = !isRepayment;
  if (!isRepayment) return;

  const unpaidInvoices = getUnpaidInvoices();
  const matchedInvoiceId = pendingRecord?.matchedInvoiceId || "";
  const autoLabel = matchedInvoiceId ? "自动匹配已找到，可改选其他 Invoice" : "自动匹配；找不到就等待认领";
  const options = repaymentInvoiceOptions(autoLabel);

  els.repaymentInvoiceSelect.innerHTML = options.join("");
  els.repaymentInvoiceSelect.disabled = unpaidInvoices.length === 0;
  els.repaymentInvoiceSelect.value = matchedInvoiceId && unpaidInvoices.some((invoice) => invoice.id === matchedInvoiceId)
    ? matchedInvoiceId
    : "__auto__";
  els.repaymentMatchStatus.textContent = unpaidInvoices.length
    ? "选择正确的公司或 Invoice 后，再按保存记录。"
    : "目前没有未付款 Invoice；保存后会先放进等待认领。";
  updateManualRepaymentSaveState();
}

function repaymentInvoiceOptions(autoLabel = "自动匹配；找不到就等待认领") {
  return [
    `<option value="__auto__">${escapeHtml(autoLabel)}</option>`,
    ...getUnpaidInvoices().map((invoice) => {
      const remaining = invoiceRemaining(invoice);
      return `<option value="${escapeHtml(invoice.id)}">${escapeHtml(invoice.supplier)} - ${escapeHtml(invoice.invoiceNo)} - 剩余 ${formatRecordMoney(invoice, remaining)}</option>`;
    })
  ];
}

function updateManualRepaymentSaveState() {
  if (selectedDirection !== "repayment" || pendingRecord) return;
  const invoice = selectedRepaymentInvoice();
  setSaveButtonsVisible(Boolean(invoice));
  if (invoice) {
    const remaining = toMoney(invoice.total - (invoice.paid || 0));
    els.detectedType.textContent = "还账 Payment Proof";
    els.resultBox.innerHTML = `
      <div class="notice-box success">
        <strong>可直接保存还账</strong>
        <p>已选择 ${escapeHtml(invoice.supplier)} / ${escapeHtml(invoice.invoiceNo)}，保存后会记录 ${formatRecordMoney(invoice, remaining)} 为还账金额。</p>
      </div>`;
    els.uploadStatus.textContent = "已选择还账对象。可以不用 OCR，直接按保存记录。";
    els.uploadStatus.className = "upload-status ready";
  }
}

function selectedRepaymentInvoice() {
  const selectedInvoiceId = els.repaymentInvoiceSelect.value;
  if (!selectedInvoiceId || selectedInvoiceId === "__auto__") return null;
  return state.invoices.find((item) => item.id === selectedInvoiceId) || null;
}

function buildManualRepaymentRecord() {
  if (selectedDirection !== "repayment") return null;
  const invoice = selectedRepaymentInvoice();
  if (!invoice) return null;
  const files = selectedUploadFiles();
  return {
    type: "payment_proof",
    recipient: invoice.supplier,
    date: new Date().toISOString().slice(0, 10),
    reference: files.length ? files.map((file) => file.name).join(", ") : `Manual repayment - ${invoice.invoiceNo}`,
    amount: invoiceRemaining(invoice),
    matchedInvoiceId: invoice.id
  };
}

function handleInvoiceRowClick(event) {
  const button = event.target.closest("[data-view-invoice]");
  if (!button) return;
  const invoice = state.invoices.find((item) => item.id === button.dataset.viewInvoice);
  if (!invoice) return;
  openInvoiceDialog(invoice);
}

function openInvoiceDialog(invoice) {
  els.invoiceDialogTitle.textContent = `${invoice.supplier} - ${invoice.invoiceNo}`;
  const receiptImages = invoice.receiptImages?.length
    ? invoice.receiptImages
    : invoice.receiptImage
      ? [invoice.receiptImage]
      : [];
  const receiptNames = invoice.receiptFileNames?.length
    ? invoice.receiptFileNames
    : invoice.receiptFileName
      ? [invoice.receiptFileName]
      : [];
  const receipt = receiptImages.length
    ? `<div class="receipt-preview-list">${receiptImages.map((image, index) => `
        <figure class="receipt-preview">
          <img src="${image}" alt="${escapeHtml(receiptNames[index] || `Invoice photo ${index + 1}`)}" />
          <figcaption>${escapeHtml(receiptNames[index] || `第 ${index + 1} 张单据`)}</figcaption>
        </figure>`).join("")}</div>`
    : `<div class="receipt-preview"><p>这笔记录没有保存照片。</p></div>`;
  const itemRows = invoice.items?.length
    ? invoice.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.product)}</td>
        <td>${item.qty}</td>
        <td class="money">${formatRecordMoney(invoice, item.unitPrice)}</td>
        <td class="money">${formatRecordMoney(invoice, item.total)}</td>
      </tr>`).join("")
    : `<tr><td colspan="4">暂无产品明细</td></tr>`;

  els.invoiceDialogBody.innerHTML = `
    <div class="invoice-detail-grid">
      ${receipt}
      <div>
        <div class="summary-grid">
          <div class="summary-item"><span>Supplier</span><strong>${escapeHtml(invoice.supplier)}</strong></div>
          <div class="summary-item"><span>Invoice</span><strong>${escapeHtml(invoice.invoiceNo)}</strong></div>
          <div class="summary-item"><span>日期</span><strong>${invoice.date}</strong></div>
          ${invoice.orderTime ? `<div class="summary-item"><span>下单时间</span><strong>${escapeHtml(invoice.orderTime)}</strong></div>` : ""}
          <div class="summary-item"><span>总金额</span><strong>${formatRecordMoney(invoice, invoice.total)}</strong></div>
        </div>
        <div class="line-items">
          <h3>产品明细</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>产品</th><th>数量</th><th>单价</th><th>金额</th></tr></thead>
              <tbody>${itemRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
  els.invoiceDialog.showModal();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToReceiptPreviewDataUrl(file) {
  if (!file.type.startsWith("image/")) return fileToDataUrl(file);
  const originalDataUrl = await fileToDataUrl(file);
  return compressImageDataUrl(originalDataUrl).catch(() => originalDataUrl);
}

function compressImageDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, RECEIPT_PREVIEW_MAX_WIDTH / image.naturalWidth);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas is not available."));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", RECEIPT_PREVIEW_QUALITY));
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function limitReceiptPreview(dataUrl) {
  const value = String(dataUrl || "");
  return value.length > 1_500_000 ? "" : value;
}

function invoiceMetadataForSupabase(invoice) {
  return {
    id: invoice.id,
    type: invoice.type,
    supplier: invoice.supplier,
    invoiceNo: invoice.invoiceNo,
    date: invoice.date,
    orderTime: invoice.orderTime || null,
    currency: invoice.currency || "MYR",
    total: invoice.total,
    paid: invoice.paid,
    status: invoice.status,
    items: invoice.items || [],
    receiptFileNames: invoice.receiptFileNames || (invoice.receiptFileName ? [invoice.receiptFileName] : []),
    settlementStatement: invoice.settlementStatement || null
  };
}

function normalizeOcrPayload(payload) {
  if (payload.type === "transaction_batch" || Array.isArray(payload.transactions)) {
    const transactions = normalizeTransactionItems(payload.transactions);
    return {
      type: "transaction_batch",
      date: payload.date || dateRangeLabel(transactions),
      amount: transactions.reduce((sum, item) => sum + item.amount, 0),
      transactions
    };
  }

  if (payload.type === "personal_expenses_batch") {
    const expenses = normalizeExpenseItems(payload.expenses);
    return {
      type: "personal_expenses_batch",
      merchant: payload.merchant || "多笔个人支出",
      date: payload.date || new Date().toISOString().slice(0, 10),
      category: payload.category || "多笔支出",
      amount: expenses.reduce((sum, item) => sum + item.amount, 0) || toMoney(payload.amount),
      expenses
    };
  }

  if (payload.type === "personal_expenses" && Array.isArray(payload.expenses) && payload.expenses.length > 1) {
    const expenses = normalizeExpenseItems(payload.expenses);
    return {
      type: "personal_expenses_batch",
      merchant: payload.merchant || "多笔个人支出",
      date: payload.date || new Date().toISOString().slice(0, 10),
      category: payload.category || "多笔支出",
      amount: expenses.reduce((sum, item) => sum + item.amount, 0),
      expenses
    };
  }

  if (payload.type === "settlement_statement") {
    return {
      type: "settlement_statement",
      date: payload.date || new Date().toISOString().slice(0, 10),
      myCompany: payload.myCompany || "Snackfactorie Enterprise",
      otherCompany: payload.otherCompany || "Pasar Mini Zai Hin",
      myItems: normalizeSettlementItems(payload.myItems),
      otherItems: normalizeSettlementItems(payload.otherItems),
      myTotal: toMoney(payload.myTotal),
      otherTotal: toMoney(payload.otherTotal),
      owedAmount: toMoney(payload.owedAmount),
      notes: payload.notes || ""
    };
  }

  if (payload.type === "income") {
    return {
      type: "income",
      payer: payload.payer || "Unknown Payer",
      date: payload.date || new Date().toISOString().slice(0, 10),
      reference: payload.reference || "-",
      amount: toMoney(payload.amount)
    };
  }

  if (payload.type === "payment_proof") {
    return {
      type: "payment_proof",
      recipient: payload.recipient || "Unknown Recipient",
      date: payload.date || new Date().toISOString().slice(0, 10),
      reference: payload.reference || "-",
      amount: toMoney(payload.amount),
      matchedInvoiceId: null
    };
  }

  return {
    type: "supplier_invoice",
    supplier: payload.supplier || "Unknown Supplier",
    invoiceNo: payload.invoiceNo || `INV-${Date.now()}`,
    date: payload.date || new Date().toISOString().slice(0, 10),
    orderTime: payload.orderTime || null,
    currency: payload.currency || (/[￥¥]|人民币|元|CNY/i.test(payload.rawText || "") ? "CNY" : "MYR"),
    items: Array.isArray(payload.items) ? payload.items.map((item) => ({
      product: item.product || "Unknown Product",
      qty: Number(item.qty || 0),
      unitPrice: toMoney(item.unitPrice),
      total: toMoney(item.total),
      currency: payload.currency || (/[￥¥]|人民币|元|CNY/i.test(payload.rawText || "") ? "CNY" : "MYR")
    })) : [],
    total: toMoney(payload.total),
    paid: 0,
    status: "Unpaid"
  };
}

function normalizeTransactionItems(items) {
  return Array.isArray(items) ? items.map((item) => {
    const description = item.description || item.payer || item.merchant || item.recipient || "Unknown Transaction";
    return applyIncomeRuleToTransaction({
    date: item.date || new Date().toISOString().slice(0, 10),
    description,
    originalDescription: description,
    reference: item.reference || item.ref || "-",
    amount: toMoney(item.amount),
    direction: ["income", "expense", "repayment"].includes(item.direction) ? item.direction : "income"
  });
  }).filter((item) => item.amount > 0) : [];
}

function normalizeExpenseItems(items) {
  return Array.isArray(items) ? items.map((item) => ({
    merchant: item.merchant || "Unknown Merchant",
    date: item.date || new Date().toISOString().slice(0, 10),
    category: normalizeExpenseCategory(item.category, item.merchant, item.note),
    amount: toMoney(item.amount),
    note: item.note || ""
  })).filter((item) => item.amount > 0) : [];
}

function normalizeExpenseCategory(category, merchant, note = "") {
  const text = normalizeSearch(`${category || ""} ${merchant || ""} ${note || ""}`);
  if (/(digi|maxis|celcom|umobile|phone|telco|电话)/i.test(text)) return "电话费";
  if (/(toll|rfid|plus|sprint)/i.test(text)) return "Toll";
  if (/(repair|service|workshop|maintenance|维修|保养)/i.test(text)) return "维修";
  if (/(mcdonald|meal|food|restaurant|吃饭)/i.test(text)) return "吃饭";
  if (/(petrol|fuel|shell|打油|汽油)/i.test(text)) return "汽油";
  if (/交通/i.test(text)) return "交通";
  if (/(google|software|subscription|软件)/i.test(text)) return "软件";
  return category || "其他";
}

function normalizeSettlementItems(items) {
  return Array.isArray(items) ? items.map((item) => ({
    description: item.description || "-",
    amount: toMoney(item.amount),
    note: item.note || ""
  })) : [];
}

function parseDocument(text, direction = "auto") {
  if (direction === "income") return parseIncome(text);
  if (direction === "outgoing") return parseSupplierInvoice(text);
  if (direction === "repayment") return parsePaymentProof(text);
  if (direction === "expense") return parsePersonalExpense(text);
  const type = classifyText(text);
  if (type === "supplier_invoice") return parseSupplierInvoice(text);
  if (type === "payment_proof") return parsePaymentProof(text);
  return parsePersonalExpense(text);
}

function applyTransactionRules(parsed, sourceText = "") {
  const haystack = normalizeSearch(`${sourceText} ${Object.values(parsed).join(" ")}`);

  const pinduoduoInvoice = normalizePinduoduoInvoice(parsed, sourceText);
  if (pinduoduoInvoice) return pinduoduoInvoice;

  if (parsed.type === "transaction_batch") {
    return {
      ...parsed,
      transactions: parsed.transactions.map(applyIncomeRuleToTransaction)
    };
  }

  if (parsed.type === "income") {
    const rule = state.incomeRules.find((item) => haystack.includes(normalizeSearch(item.match)));
    return rule ? { ...parsed, payer: rule.source } : applyIncomeRuleToTransaction(parsed);
  }

  if (parsed.type === "personal_expenses_batch") {
    const expenses = parsed.expenses.map((expense) => applyExpenseRule(expense));
    return {
      ...parsed,
      expenses,
      amount: expenses.reduce((sum, expense) => sum + expense.amount, 0)
    };
  }

  if (parsed.type === "supplier_invoice" || parsed.type === "personal_expenses") {
    const rule = state.outgoingRules.find((item) => haystack.includes(normalizeSearch(item.match)));
    if (!rule) return parsed;

    if (rule.target === "personal_expenses") {
      return {
        type: "personal_expenses",
        merchant: expenseRuleDisplayName(rule, parsed.supplier || parsed.merchant),
        date: parsed.date || new Date().toISOString().slice(0, 10),
        category: rule.name,
        amount: toMoney(parsed.total || parsed.amount || 0)
      };
    }

    return {
      ...parsed,
      type: "supplier_invoice",
      supplier: rule.name || parsed.supplier || "Unknown Supplier",
      items: parsed.items || [],
      total: toMoney(parsed.total || parsed.amount || 0),
      paid: parsed.paid || 0,
      status: parsed.status || "Unpaid"
    };
  }

  return parsed;
}

function normalizePinduoduoInvoice(parsed, sourceText = "") {
  const text = `${sourceText} ${JSON.stringify(parsed)}`;
  if (!isPinduoduoVoucher(text)) return null;

  const orderTime = findPinduoduoOrderTime(text);
  const date = parsed.date || orderTime?.slice(0, 10) || findPinduoduoDate(text) || new Date().toISOString().slice(0, 10);
  const invoiceNo = findPinduoduoOrderNo(text) || parsed.invoiceNo || parsed.reference || `PDD-${Date.now()}`;
  const total = toMoney(parsed.total || parsed.amount || findPinduoduoPaidAmount(text));
  const product = findPinduoduoProduct(text) || parsed.items?.[0]?.product || parsed.merchant || "拼多多商品";
  const currency = findPinduoduoCurrency(text);

  return {
    type: "supplier_invoice",
    supplier: "拼多多",
    invoiceNo,
    date,
    orderTime,
    currency,
    items: [
      {
        product: renameProduct(product),
        qty: 1,
        unitPrice: total,
        total,
        currency
      }
    ],
    total,
    paid: 0,
    status: "Unpaid"
  };
}

function isPinduoduoVoucher(text) {
  const normalized = normalizeSearch(text);
  return normalized.includes("拼多多")
    || normalized.includes("pinduoduo")
    || (normalized.includes("订单编号") && normalized.includes("实付"))
    || (normalized.includes("快递单号") && normalized.includes("下单时间"));
}

function findPinduoduoOrderNo(text) {
  return findPattern(text, /订单编号[：:\s]*([A-Z0-9-]{8,})/i).replace(/^订单编号[：:\s]*/i, "")
    || findPattern(text, /\b\d{6,}-\d{8,}\b/);
}

function findPinduoduoPaidAmount(text) {
  const paid = text.match(/实付[：:\s￥¥RM元CNY]*([\d,]+(?:\.\d{1,2})?)/i);
  return paid ? toMoney(paid[1]) : findLargestAmount(text);
}

function findPinduoduoCurrency(text) {
  return /[￥¥]|人民币|元|CNY/i.test(text) ? "CNY" : "MYR";
}

function findPinduoduoOrderTime(text) {
  const match = text.match(/(?:下单时间|拼单时间)[：:\s]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (!match) return "";
  const date = findDate(match[1]);
  return match[2] ? `${date} ${match[2]}` : date;
}

function findPinduoduoDate(text) {
  const match = text.match(/(?:下单时间|拼单时间|发货时间)[：:\s]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);
  return match ? findDate(match[1]) : findDate(text);
}

function findPinduoduoProduct(text) {
  const lines = String(text).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const productLine = lines.find((line) => /[a-zA-Z\u4e00-\u9fff]/.test(line)
    && !/(拼多多|订单编号|支付方式|物流公司|快递单号|下单时间|拼单时间|发货时间|实付|确认收货|申请退款|联系商家|分享商品)/.test(line)
    && line.length >= 6);
  return productLine ? cleanValue(productLine).slice(0, 80) : "";
}

function applyIncomeRuleToTransaction(transaction) {
  const haystack = normalizeSearch(`${transaction.description || ""} ${transaction.payer || ""} ${transaction.reference || ""}`);
  const rule = state.incomeRules.find((item) => haystack.includes(normalizeSearch(item.match)));
  if (!rule) return transaction;
  if (transaction.type === "income") return { ...transaction, payer: rule.source };
  return { ...transaction, originalDescription: transaction.originalDescription || transaction.description, description: rule.source };
}

function applyIncomeRuleToIncome(income) {
  const originalPayer = income.originalPayer || income.payer || "Unknown Payer";
  const haystack = normalizeSearch(`${originalPayer} ${income.reference || ""}`);
  const rule = state.incomeRules.find((item) => haystack.includes(normalizeSearch(item.match)));
  return {
    ...income,
    originalPayer,
    payer: rule ? rule.source : originalPayer
  };
}

function reapplyIncomeRules() {
  state.incomes = state.incomes.map(applyIncomeRuleToIncome);
}

function applyExpenseRule(expense) {
  const haystack = normalizeSearch(`${expense.merchant} ${expense.category} ${expense.note || ""}`);
  const rule = state.outgoingRules.find((item) => item.target === "personal_expenses" && haystack.includes(normalizeSearch(item.match)));
  return rule ? { ...expense, category: rule.name, merchant: expenseRuleDisplayName(rule, expense.merchant) } : expense;
}

function expenseRuleDisplayName(rule, fallback = "") {
  return rule.displayName || rule.alias || fallback || rule.name || "其他";
}

function reapplyExpenseRules() {
  state.expenses = state.expenses.map((expense) => {
    const baseCategory = normalizeExpenseCategory("", expense.merchant, expense.note);
    return applyExpenseRule({
      ...expense,
      category: baseCategory === "其他" ? expense.category : baseCategory
    });
  });
}

function groupInvoiceRows(invoices) {
  return groupRecords(invoices, (invoice) => invoice.supplier || "Unknown Supplier")
    .map((group) => ({
      ...group,
      supplier: group.label,
      currency: group.records.every((invoice) => (invoice.currency || "MYR") === (group.records[0].currency || "MYR"))
        ? group.records[0].currency || "MYR"
        : "MIXED",
      total: sumRecords(group.records, "total"),
      paid: sumRecords(group.records, "paid"),
      remaining: group.records.reduce((sum, invoice) => sum + invoiceRemaining(invoice), 0),
      status: group.records.every((invoice) => invoice.status === "Paid") ? "Paid" : "Pending"
    }))
    .sort((a, b) => b.remaining - a.remaining);
}

function groupIncomeRows(incomes) {
  return groupRecords(incomes, (income) => income.payer || "Unknown Payer")
    .map((group) => ({
      ...group,
      payer: group.label,
      amount: sumRecords(group.records, "amount")
    }))
    .sort((a, b) => b.amount - a.amount);
}

function groupExpenseRows(expenses) {
  return groupRecords(expenses, (expense) => `${expense.category || "其他"}__${expense.merchant || "其他"}`)
    .map((group) => {
      const [category, merchant] = group.label.split("__");
      return {
        ...group,
        merchant,
        category,
        amount: sumRecords(group.records, "amount")
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

function groupRecords(records, labelForRecord) {
  const groups = new Map();
  records.forEach((record) => {
    const label = labelForRecord(record);
    const current = groups.get(label) || { label, records: [], dateSet: new Set() };
    current.records.push(record);
    current.dateSet.add(record.date || "-");
    groups.set(label, current);
  });
  return [...groups.values()].map((group) => {
    const dates = [...group.dateSet].sort();
    return {
      ...group,
      date: dates.length === 1 ? dates[0] : `${dates[0]} - ${dates[dates.length - 1]}`,
      count: group.records.length
    };
  });
}

function sumRecords(records, key) {
  return toMoney(records.reduce((sum, record) => sum + Number(record[key] || 0), 0));
}

function renderInvoiceGroupRow(group) {
  const detailRows = group.records.map((invoice) => `
    <tr>
      <td>${escapeHtml(invoice.invoiceNo)}</td>
      <td>${escapeHtml(invoice.date)}</td>
      <td class="money">${formatRecordMoney(invoice, invoice.total)}</td>
      <td class="money">${formatRecordMoney(invoice, invoice.paid || 0)}</td>
      <td class="${invoice.status === "Paid" ? "paid" : "pending"}">${escapeHtml(invoice.status)}</td>
      <td><button class="detail-actions-btn" data-view-invoice="${escapeHtml(invoice.id)}" type="button">查看单据</button></td>
    </tr>`).join("");
  return `
    <tr class="group-row">
      <td colspan="7">
        <details>
          <summary>
            <strong>${escapeHtml(group.supplier)}</strong>
            <span>${group.count} 张</span>
            <span>日期：${escapeHtml(group.date)}</span>
            <span>总额：${formatRecordMoney(group, group.total)}</span>
            <span>已付：${formatRecordMoney(group, group.paid)}</span>
            <span>未付：${formatRecordMoney(group, group.remaining)}</span>
          </summary>
          <div class="nested-table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>日期</th><th>金额</th><th>已付</th><th>状态</th><th>单据</th></tr></thead>
              <tbody>${detailRows}</tbody>
            </table>
          </div>
        </details>
      </td>
    </tr>`;
}

function renderIncomeGroupRow(group) {
  const detailRows = group.records.map((income) => `
    <tr>
      <td>${escapeHtml(income.date)}</td>
      <td>${escapeHtml(income.reference)}</td>
      <td class="money paid">${formatMoney(income.amount)}</td>
    </tr>`).join("");
  return `
    <tr class="group-row">
      <td colspan="4">
        <details>
          <summary>
            <strong>${escapeHtml(group.payer)}</strong>
            <span>${group.count} 笔</span>
            <span>日期：${escapeHtml(group.date)}</span>
            <span>金额：${formatMoney(group.amount)}</span>
          </summary>
          <div class="nested-table-wrap">
            <table>
              <thead><tr><th>日期</th><th>Reference</th><th>金额</th></tr></thead>
              <tbody>${detailRows}</tbody>
            </table>
          </div>
        </details>
      </td>
    </tr>`;
}

function renderExpenseGroupRow(group) {
  const detailRows = group.records.map((expense) => `
    <tr>
      <td>${escapeHtml(expense.date)}</td>
      <td>${escapeHtml(expense.merchant || "-")}</td>
      <td class="money">${formatMoney(expense.amount)}</td>
    </tr>`).join("");
  return `
    <tr class="group-row">
      <td colspan="4">
        <details>
          <summary>
            <strong>${escapeHtml(group.merchant)}</strong>
            <span><span class="chip">${escapeHtml(group.category)}</span></span>
            <span>${group.count} 笔</span>
            <span>日期：${escapeHtml(group.date)}</span>
            <span>金额：${formatMoney(group.amount)}</span>
          </summary>
          <div class="nested-table-wrap">
            <table>
              <thead><tr><th>日期</th><th>Payee / Merchant</th><th>金额</th></tr></thead>
              <tbody>${detailRows}</tbody>
            </table>
          </div>
        </details>
      </td>
    </tr>`;
}

function renderPaymentRow({ payment, invoice }) {
  return `<tr>
    <td>${payment.date}</td>
    <td>${escapeHtml(payment.recipient)}</td>
    <td>${escapeHtml(payment.reference)}</td>
    <td class="money">${formatMoney(payment.amount)}</td>
    <td class="${invoice ? "paid" : "unmatched"}">${invoice ? escapeHtml(invoice.invoiceNo) : "等待认领"}</td>
  </tr>`;
}

function classifyText(text) {
  const lower = text.toLowerCase();
  const paymentScore = score(lower, ["transfer", "duitnow", "reference", "ref no", "recipient", "paid"]);
  const invoiceScore = score(lower, ["invoice", "supplier", "qty", "quantity", "unit price", "inv-"]);
  const expenseScore = score(lower, ["receipt", "merchant", "cash", "petrol", "parking", "meal", "restaurant"]);
  if (paymentScore >= Math.max(invoiceScore, expenseScore) && paymentScore >= 2) return "payment_proof";
  if (invoiceScore >= Math.max(paymentScore, expenseScore) && invoiceScore >= 1) return "supplier_invoice";
  return "personal_expenses";
}

function score(text, words) {
  return words.reduce((total, word) => total + (text.includes(word) ? 1 : 0), 0);
}

function parseSupplierInvoice(text) {
  const date = findDate(text);
  const supplier = findLabel(text, ["Supplier", "Vendor", "From"]) || firstBusinessLine(text) || "Unknown Supplier";
  const invoiceNo = findLabel(text, ["Invoice No", "Invoice", "INV"]) || findPattern(text, /\bINV[-\s]?\d+\b/i) || `INV-${Date.now()}`;
  const total = findAmount(text, ["Total", "Amount Due", "Grand Total"]);
  const items = parseLineItems(text);
  const computedTotal = items.reduce((sum, item) => sum + item.total, 0);
  return {
    type: "supplier_invoice",
    supplier,
    invoiceNo,
    date,
    items,
    total: total || computedTotal,
    paid: 0,
    status: "Unpaid"
  };
}

function parseIncome(text) {
  const payer = findLabel(text, ["Payer", "Customer", "From", "Received From"]) || firstBusinessLine(text) || "Unknown Payer";
  return {
    type: "income",
    payer,
    originalPayer: payer,
    date: findDate(text),
    reference: findLabel(text, ["Reference No", "Reference", "Ref No", "Ref"]) || findPattern(text, /\b[A-Z]{2,}[-\d]{5,}\b/i) || "-",
    amount: findAmount(text, ["Amount", "Total", "Received", "Paid"]) || findLargestAmount(text)
  };
}

function parsePersonalExpense(text) {
  return {
    type: "personal_expenses",
    merchant: findLabel(text, ["Merchant", "Shop", "Store", "Payee"]) || firstBusinessLine(text) || "Unknown Merchant",
    date: findDate(text),
    category: categorizeExpense(text),
    amount: findAmount(text, ["Amount", "Total", "Paid"]) || findLargestAmount(text)
  };
}

function parsePaymentProof(text) {
  const amount = findAmount(text, ["Amount Paid", "Amount", "Total", "Paid"]) || findLargestAmount(text);
  const recipient = findLabel(text, ["Recipient", "Payee", "To", "Receiver"]) || firstBusinessLine(text) || "Unknown Recipient";
  const payment = {
    type: "payment_proof",
    recipient,
    date: findDate(text),
    reference: findLabel(text, ["Reference No", "Reference", "Ref No", "Ref"]) || findPattern(text, /\b[A-Z]{2,}\d{5,}\b/i) || "-",
    amount,
    matchedInvoiceId: null
  };
  const match = matchInvoice(payment);
  if (match) payment.matchedInvoiceId = match.id;
  return payment;
}

function findDuplicateSavedRecord(record) {
  if (!record) return null;
  if (record.type === "supplier_invoice") return duplicateSupplierInvoice(record);
  if (record.type === "settlement_statement") return duplicateSettlementStatement(record);
  if (record.type === "income") return duplicateIncome(record);
  if (record.type === "payment_proof") return duplicatePayment(record);
  if (record.type === "personal_expenses") return duplicateExpense(record);
  if (record.type === "personal_expenses_batch") return duplicateExpenseBatch(record);
  if (record.type === "transaction_batch") return duplicateTransactionBatch(record);
  return null;
}

function duplicateSupplierInvoice(record) {
  const duplicate = state.invoices.find((invoice) => {
    const sameInvoiceNo = normalizeSearch(invoice.invoiceNo) && normalizeSearch(invoice.invoiceNo) === normalizeSearch(record.invoiceNo);
    const sameSupplier = normalizeSearch(invoice.supplier) === normalizeSearch(record.supplier);
    const sameAmountDate = sameSupplier && sameDate(invoice.date, record.date) && sameMoney(invoice.total, record.total);
    return (sameSupplier && sameInvoiceNo) || sameAmountDate;
  });
  return duplicate ? duplicateNotice("待付款 Invoice", `${duplicate.supplier} / ${duplicate.invoiceNo} / ${formatMoney(duplicate.total)}`) : null;
}

function duplicateSettlementStatement(record) {
  const invoice = settlementToInvoice({ ...record });
  const duplicate = state.invoices.find((item) => {
    const existingSettlement = item.settlementStatement || {};
    return normalizeSearch(item.supplier) === normalizeSearch(invoice.supplier)
      && sameDate(item.date, invoice.date)
      && sameMoney(item.total, invoice.total)
      && (
        normalizeSearch(item.invoiceNo) === normalizeSearch(invoice.invoiceNo)
        || normalizeSearch(existingSettlement.otherCompany) === normalizeSearch(record.otherCompany)
      );
  });
  return duplicate ? duplicateNotice("对账 / 待付款 Invoice", `${duplicate.supplier} / ${duplicate.invoiceNo} / ${formatMoney(duplicate.total)}`) : null;
}

function duplicateIncome(record) {
  const duplicate = state.incomes.find((income) => {
    const sameReference = meaningfulText(record.reference) && normalizeSearch(income.reference) === normalizeSearch(record.reference);
    const samePayer = normalizeSearch(income.payer) === normalizeSearch(record.payer)
      || normalizeSearch(income.originalPayer) === normalizeSearch(record.originalPayer || record.payer);
    return sameDate(income.date, record.date)
      && sameMoney(income.amount, record.amount)
      && (sameReference || samePayer);
  });
  return duplicate ? duplicateNotice("进账记录", `${duplicate.payer} / ${duplicate.reference} / ${formatMoney(duplicate.amount)}`) : null;
}

function duplicatePayment(record) {
  const duplicate = state.payments.find((payment) => {
    const sameReference = meaningfulText(record.reference) && normalizeSearch(payment.reference) === normalizeSearch(record.reference);
    const sameRecipient = normalizeSearch(payment.recipient) === normalizeSearch(record.recipient);
    const sameInvoice = record.matchedInvoiceId && payment.matchedInvoiceId === record.matchedInvoiceId;
    return sameDate(payment.date, record.date)
      && sameMoney(payment.amount, record.amount)
      && (sameReference || sameRecipient || sameInvoice);
  });
  return duplicate ? duplicateNotice("还账 / 付款证明", `${duplicate.recipient} / ${duplicate.reference} / ${formatMoney(duplicate.amount)}`) : null;
}

function duplicateExpense(record) {
  const duplicate = state.expenses.find((expense) => sameDate(expense.date, record.date)
    && sameMoney(expense.amount, record.amount)
    && normalizeSearch(expense.merchant) === normalizeSearch(record.merchant)
    && normalizeSearch(expense.category) === normalizeSearch(record.category));
  return duplicate ? duplicateNotice("个人支出", `${duplicate.merchant} / ${duplicate.category} / ${formatMoney(duplicate.amount)}`) : null;
}

function duplicateExpenseBatch(record) {
  applyExpenseBatchDestinations(record);
  const expenses = record.expenses || [];
  if (!expenses.length) return null;
  const allDuplicate = expenses.every((expense) => {
    if (expense.destination === "materials") return duplicateSupplierInvoice(expenseToMaterialInvoice(expense));
    if (expense.destination === "touchngo") return duplicateWalletTransfer({
      date: expense.date,
      payee: expense.merchant || "Touch 'n Go",
      reference: expense.note || "Bank to Touch 'n Go",
      amount: expense.amount
    });
    return duplicateExpense(expense);
  });
  return allDuplicate ? duplicateNotice("多笔个人支出", `${expenses.length} 笔明细都已经保存过`) : null;
}

function duplicateTransactionBatch(record) {
  applyTransactionBatchDestinations(record);
  const transactions = record.transactions || [];
  if (!transactions.length) return null;
  const allDuplicate = transactions.every((transaction) => {
    if (transaction.destination === "expense") return duplicateExpense(transactionToExpense(transaction));
    if (transaction.destination === "repayment" || transaction.destination === "claim") return duplicatePayment(transactionToPayment(transaction));
    return duplicateIncome(transactionToIncome(transaction));
  });
  return allDuplicate ? duplicateNotice("多笔交易", `${transactions.length} 笔明细都已经保存过`) : null;
}

function duplicateWalletTransfer(record) {
  const duplicate = state.walletTransfers.find((transfer) => {
    const sameReference = meaningfulText(record.reference) && normalizeSearch(transfer.reference) === normalizeSearch(record.reference);
    const samePayee = normalizeSearch(transfer.payee) === normalizeSearch(record.payee);
    return sameDate(transfer.date, record.date)
      && sameMoney(transfer.amount, record.amount)
      && (sameReference || samePayee);
  });
  return duplicate ? duplicateNotice("Touch 'n Go 转账记录", `${duplicate.payee} / ${duplicate.reference} / ${formatMoney(duplicate.amount)}`) : null;
}

function duplicateNotice(section, detail) {
  return {
    section,
    message: `已经在「${section}」找到相同记录：${detail}`
  };
}

function recordParsedDocument(parsed) {
  if (parsed.type === "settlement_statement") {
    const invoice = settlementToInvoice(parsed);
    state.invoices.push(invoice);
    claimPendingPaymentsForInvoice(invoice);
    return;
  }
  if (parsed.type === "income") {
    const income = applyIncomeRuleToIncome({ ...parsed, id: crypto.randomUUID() });
    state.incomes.push(income);
    state.cashOnHand = toMoney(state.cashOnHand + income.amount);
  }
  if (parsed.type === "supplier_invoice") {
    const invoice = applyRenameRulesToInvoice({ ...parsed, id: crypto.randomUUID() });
    state.invoices.push(invoice);
    updateInventoryFromInvoice(invoice);
    claimPendingPaymentsForInvoice(invoice);
  }
  if (parsed.type === "personal_expenses") {
    state.expenses.push({ ...parsed, id: crypto.randomUUID() });
  }
  if (parsed.type === "personal_expenses_batch") {
    applyExpenseBatchDestinations(parsed);
    parsed.expenses.forEach((expense) => {
      if (expense.destination === "materials") {
        const invoice = expenseToMaterialInvoice(expense);
        state.invoices.push(invoice);
        updateInventoryFromInvoice(invoice);
        claimPendingPaymentsForInvoice(invoice);
      } else if (expense.destination === "touchngo") {
        state.walletTransfers.push({
          date: expense.date,
          payee: expense.merchant || "Touch 'n Go",
          reference: expense.note || "Bank to Touch 'n Go",
          amount: expense.amount,
          id: crypto.randomUUID()
        });
      } else {
        state.expenses.push({ ...expense, id: crypto.randomUUID() });
      }
    });
  }
  if (parsed.type === "transaction_batch") {
    applyTransactionBatchDestinations(parsed);
    parsed.transactions.forEach((transaction) => {
      if (transaction.destination === "expense") {
        state.expenses.push(transactionToExpense(transaction));
      } else if (transaction.destination === "repayment" || transaction.destination === "claim") {
        applyPayment(transactionToPayment(transaction));
      } else {
        const income = transactionToIncome(transaction);
        state.incomes.push(income);
        state.cashOnHand = toMoney(state.cashOnHand + income.amount);
      }
    });
  }
  if (parsed.type === "payment_proof") {
    applyPayment(parsed);
  }
}

function settlementToInvoice(statement) {
  const supplier = statement.otherCompany || "Pasar Mini Zai Hin";
  const date = statement.date || new Date().toISOString().slice(0, 10);
  const total = toMoney(statement.owedAmount || Math.max((statement.myTotal || 0) - (statement.otherTotal || 0), 0));
  return {
    id: crypto.randomUUID(),
    type: "supplier_invoice",
    supplier,
    invoiceNo: `SETTLE-${date}`,
    date,
    items: [
      {
        product: `对账欠款 - ${statement.myCompany || "Snackfactorie Enterprise"} / ${supplier}`,
        qty: 1,
        unitPrice: total,
        total
      }
    ],
    total,
    paid: 0,
    status: "Unpaid",
    settlementStatement: statement
  };
}

function applyExpenseBatchDestinations(record) {
  if (record.type !== "personal_expenses_batch") return;
  record.expenses = record.expenses.map((expense, index) => {
    const select = els.resultBox.querySelector(`[data-expense-destination="${index}"]`);
    return {
      ...expense,
      destination: select?.value || expense.destination || "personal"
    };
  });
}

function applyTransactionBatchDestinations(record) {
  if (record.type !== "transaction_batch") return;
  record.transactions = record.transactions.map((transaction, index) => {
    const select = els.resultBox.querySelector(`[data-transaction-destination="${index}"]`);
    const invoiceSelect = els.resultBox.querySelector(`[data-transaction-invoice="${index}"]`);
    return {
      ...transaction,
      destination: select?.value || transaction.direction || "income",
      matchedInvoiceId: invoiceSelect?.value && invoiceSelect.value !== "__auto__" ? invoiceSelect.value : null
    };
  });
}

function transactionToIncome(transaction) {
  const normalized = applyIncomeRuleToTransaction(transaction);
  return {
    id: crypto.randomUUID(),
    type: "income",
    payer: normalized.description || "Unknown Payer",
    originalPayer: transaction.originalDescription || transaction.description || normalized.description || "Unknown Payer",
    date: normalized.date || new Date().toISOString().slice(0, 10),
    reference: normalized.reference || "-",
    amount: toMoney(normalized.amount)
  };
}

function transactionToExpense(transaction) {
  return applyExpenseRule({
    id: crypto.randomUUID(),
    type: "personal_expenses",
    merchant: transaction.description || "Unknown Merchant",
    date: transaction.date || new Date().toISOString().slice(0, 10),
    category: categorizeExpense(transaction.description || ""),
    amount: toMoney(transaction.amount),
    note: transaction.reference || ""
  });
}

function transactionToPayment(transaction) {
  const invoice = transaction.matchedInvoiceId
    ? state.invoices.find((item) => item.id === transaction.matchedInvoiceId)
    : null;
  return {
    type: "payment_proof",
    recipient: invoice?.supplier || transaction.description || "Unknown Recipient",
    date: transaction.date || new Date().toISOString().slice(0, 10),
    reference: transaction.reference || "-",
    amount: toMoney(transaction.amount),
    matchedInvoiceId: invoice?.id || null,
    waitingClaim: transaction.destination === "claim" || !invoice?.id
  };
}

function expenseToMaterialInvoice(expense) {
  const total = toMoney(expense.amount);
  return {
    id: crypto.randomUUID(),
    type: "supplier_invoice",
    supplier: expense.merchant || "Company Materials",
    invoiceNo: `MAT-${expense.date}-${crypto.randomUUID().slice(0, 6)}`,
    date: expense.date || new Date().toISOString().slice(0, 10),
    items: [
      {
        product: expense.merchant || "公司材料费",
        qty: 1,
        unitPrice: total,
        total
      }
    ],
    total,
    paid: total,
    status: "Paid"
  };
}

function applyRenameRulesToInvoice(invoice) {
  return {
    ...invoice,
    items: invoice.items.map((item) => ({
      ...item,
      product: renameProduct(item.product)
    }))
  };
}

function renameProduct(productName) {
  const product = String(productName || "");
  const normalizedProduct = product.toLowerCase();
  const rule = state.renameRules.find((item) => normalizedProduct.includes(String(item.match || "").toLowerCase()));
  return rule ? rule.name : product;
}

function rebuildInventoryFromInvoices() {
  state.inventory = {};
  state.invoices = state.invoices.map(applyRenameRulesToInvoice);
  state.invoices.forEach(updateInventoryFromInvoice);
}

function fixKnownUnknownSuppliers() {
  state.invoices = state.invoices.map((invoice) => {
    const supplier = normalizeSearch(invoice.supplier);
    const invoiceNo = String(invoice.invoiceNo || "");
    if ((supplier === "unknown supplier" || !supplier) && /\b\d?CR\d{5,}\b/i.test(invoiceNo)) {
      return { ...invoice, supplier: "BEN MART TRADING SDN BHD" };
    }
    return invoice;
  });
}

function applyPayment(payment) {
  const stored = { ...payment, id: crypto.randomUUID() };
  const invoice = payment.matchedInvoiceId
    ? state.invoices.find((item) => item.id === payment.matchedInvoiceId)
    : matchInvoice(payment);
  if (invoice) {
    stored.matchedInvoiceId = invoice.id;
    invoice.paid = toMoney((invoice.paid || 0) + stored.amount);
    invoice.status = invoice.paid + 0.01 >= invoice.total ? "Paid" : "Partial";
  }
  state.payments.push(stored);
}

function claimPendingPaymentsForInvoice(invoice) {
  state.payments
    .filter((payment) => !payment.matchedInvoiceId)
    .forEach((payment) => {
      if (!paymentClaimsInvoice(payment, invoice)) return;
      const remaining = invoiceRemaining(invoice);
      if (remaining <= 0.01) return;
      payment.matchedInvoiceId = invoice.id;
      payment.waitingClaim = false;
      payment.claimedAt = new Date().toISOString();
      const appliedAmount = Math.min(payment.amount || 0, remaining);
      invoice.paid = toMoney((invoice.paid || 0) + appliedAmount);
      invoice.status = invoice.paid + 0.01 >= invoice.total ? "Paid" : "Partial";
    });
}

function paymentClaimsInvoice(payment, invoice) {
  const recipient = normalize(payment.recipient);
  const supplier = normalize(invoice.supplier);
  const textMatch = recipient && supplier && (recipient.includes(supplier) || supplier.includes(recipient));
  const amountMatch = Math.abs(invoiceRemaining(invoice) - Number(payment.amount || 0)) < 0.02;
  return textMatch || amountMatch;
}

function matchInvoice(payment) {
  const unpaid = getUnpaidInvoices();
  return unpaid.find((invoice) => normalize(invoice.supplier).includes(normalize(payment.recipient)) || normalize(payment.recipient).includes(normalize(invoice.supplier)))
    || unpaid.find((invoice) => Math.abs((invoice.total - (invoice.paid || 0)) - payment.amount) < 0.02)
    || null;
}

function getUnpaidInvoices() {
  return state.invoices.filter((invoice) => invoiceRemaining(invoice) > 0.01);
}

function invoiceRemaining(invoice) {
  return toMoney(Math.max((invoice.total || 0) - (invoice.paid || 0), 0));
}

function invoiceRemainingByCurrency(invoices) {
  return invoices.reduce((totals, invoice) => {
    const currency = invoice.currency || "MYR";
    totals[currency] = toMoney((totals[currency] || 0) + invoiceRemaining(invoice));
    return totals;
  }, {});
}

function updateInventoryFromInvoice(invoice) {
  invoice.items.forEach((item) => {
    const key = inventoryKey(item.product);
    const existing = state.inventory[key];
    if (!existing || new Date(invoice.date) >= new Date(existing.invoiceDate)) {
      state.inventory[key] = {
        product: item.product,
        latestCost: item.unitPrice,
        currency: invoice.currency || item.currency || "MYR",
        invoiceDate: invoice.date,
        supplier: invoice.supplier
      };
    }
  });
}

function handleCostCalculatorInput(event) {
  const input = event.target.closest("[data-calc-key]");
  if (!input) return;

  const key = input.dataset.calcKey;
  const field = input.dataset.calcField;
  const current = state.costCalculators[key] || { total: "", divisor: "" };
  current[field] = input.value;
  state.costCalculators[key] = current;
  saveState();
  updateCostCalculatorResult(key);
}

function updateCostCalculatorResult(key) {
  const row = document.querySelector(`[data-calc-result="${cssEscape(key)}"]`);
  if (!row) return;
  row.textContent = formatMoney(calculateCostResult(state.costCalculators[key]));
}

function calculateCostResult(calculator) {
  const total = Number(calculator?.total || 0);
  const divisor = Number(calculator?.divisor || 0);
  if (!total || !divisor) return 0;
  return toMoney(total / divisor);
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replaceAll('"', '\\"');
}

function parseLineItems(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/(invoice|supplier|date|total|amount|tax|subtotal)/i.test(line))
    .map((line) => {
      const parts = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+(?:RM\s*)?(\d+(?:\.\d+)?)\s+(?:RM\s*)?(\d+(?:\.\d+)?)$/i);
      if (!parts) return null;
      return {
        product: parts[1].trim(),
        qty: Number(parts[2]),
        unitPrice: toMoney(parts[3]),
        total: toMoney(parts[4])
      };
    })
    .filter(Boolean);
}

function findLabel(text, labels) {
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*(?:No\\.)?\\s*[:#-]?\\s*([^\\n]+)`, "i");
    const match = text.match(regex);
    if (match) return cleanValue(match[1]);
  }
  return "";
}

function findDate(text) {
  const match = text.match(/\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/);
  if (!match) return new Date().toISOString().slice(0, 10);
  const raw = match[1].replace(/\./g, "/");
  const parts = raw.split(/[-/]/).map(Number);
  if (parts[0] > 1900) return `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
  return `${parts[2]}-${pad(parts[1])}-${pad(parts[0])}`;
}

function findAmount(text, labels) {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^\\d]{0,18}(?:RM|MYR|USD)?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, "i");
    const match = text.match(regex);
    if (match) return toMoney(match[1]);
  }
  return 0;
}

function findLargestAmount(text) {
  const amounts = [...text.matchAll(/(?:RM|MYR|USD)?\s*([\d,]+\.\d{2})/gi)].map((match) => toMoney(match[1]));
  return amounts.length ? Math.max(...amounts) : 0;
}

function findPattern(text, regex) {
  const match = text.match(regex);
  return match ? match[0].trim() : "";
}

function firstBusinessLine(text) {
  return text.split(/\n+/).map((line) => line.trim()).find((line) => /sdn|bhd|trading|enterprise|restaurant|shell|petronas|store|mart/i.test(line)) || "";
}

function categorizeExpense(text) {
  const lower = text.toLowerCase();
  if (/(meal|food|restaurant|mamak|kopitiam|cafe|lunch|dinner)/.test(lower)) return "吃饭";
  if (/(petrol|fuel|ron95|ron97|shell|petronas|bhp|caltex)/.test(lower)) return "汽油";
  if (/(repair|service|workshop|maintenance|维修|保养)/.test(lower)) return "维修";
  if (/(parking|park)/.test(lower)) return "停车";
  if (/(telco|maxis|digi|celcom|umobile|phone|internet|电话)/.test(lower)) return "电话费";
  if (/(toll|rfid|plus|sprint)/.test(lower)) return "Toll";
  if (/(grab|taxi|transport|lrt|mrt|bus)/.test(lower)) return "交通";
  return "其他";
}

function render() {
  els.cashInput.value = state.cashOnHand;
  els.monthInput.value = selectedMonth;
  const monthInvoices = filterByMonth(state.invoices, "date");
  const monthExpenses = filterByMonth(state.expenses, "date");
  const monthPayments = filterByMonth(state.payments, "date");
  const payableByCurrency = invoiceRemainingByCurrency(monthInvoices);
  const payable = payableByCurrency.MYR || 0;
  const companyExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const spent = companyExpenses
    + monthPayments.reduce((sum, payment) => sum + payment.amount, 0);
  els.cashMetric.textContent = formatMoney(state.cashOnHand);
  els.payableMetric.textContent = formatOutflowCurrencyTotals(payableByCurrency);
  els.spentMetric.textContent = formatOutflowMoney(spent);
  els.companyExpenseMetric.textContent = formatOutflowMoney(companyExpenses);
  els.availableMetric.textContent = formatMoney(state.cashOnHand - payable);
  renderTables();
  updateRepaymentMatchPanel();
}

function renderTables() {
  const monthIncomes = filterByMonth(state.incomes, "date");
  const monthInvoices = filterByMonth(state.invoices, "date");
  const monthExpenses = filterByMonth(state.expenses, "date");
  const monthPayments = filterByMonth(state.payments, "date");
  const monthWalletTransfers = filterByMonth(state.walletTransfers, "date");
  const expenseRules = state.outgoingRules.filter((rule) => rule.target === "personal_expenses");
  els.expenseRuleRows.innerHTML = rowsOrEmpty(expenseRules.map((rule) => `
    <tr>
      <td>${escapeHtml(rule.match)}</td>
      <td>${escapeHtml(expenseRuleDisplayName(rule))}</td>
      <td>${escapeHtml(rule.name)}</td>
      <td><button class="delete-rule-btn" data-delete-expense-rule="${escapeHtml(rule.id)}" type="button">删除</button></td>
    </tr>`), 4);

  els.incomeRuleRows.innerHTML = rowsOrEmpty(state.incomeRules.map((rule) => `
    <tr>
      <td>${escapeHtml(rule.match)}</td>
      <td>${escapeHtml(rule.source)}</td>
      <td><button class="delete-rule-btn" data-delete-income-rule="${escapeHtml(rule.id)}" type="button">删除</button></td>
    </tr>`), 3);

  els.outgoingRuleRows.innerHTML = rowsOrEmpty(state.outgoingRules.map((rule) => `
    <tr>
      <td>${escapeHtml(rule.match)}</td>
      <td>${rule.target === "personal_expenses" ? "个人支出" : "Supplier Invoice"}</td>
      <td>${escapeHtml(rule.name)}</td>
      <td><button class="delete-rule-btn" data-delete-outgoing-rule="${escapeHtml(rule.id)}" type="button">删除</button></td>
    </tr>`), 4);

  const renameRuleQuery = normalizeSearch(els.ruleMatchInput.value);
  const visibleRenameRules = renameRuleQuery
    ? state.renameRules.filter((rule) => normalizeSearch(`${rule.match} ${rule.name}`).includes(renameRuleQuery))
    : [];
  els.renameRuleRows.innerHTML = renameRuleQuery
    ? rowsOrEmpty(visibleRenameRules.map((rule) => `
    <tr>
      <td>${escapeHtml(rule.match)}</td>
      <td>${escapeHtml(rule.name)}</td>
      <td><button class="delete-rule-btn" data-delete-rule="${escapeHtml(rule.id)}" type="button">删除</button></td>
    </tr>`), 3)
    : `<tr><td colspan="3">输入 OCR 字眼后才显示相关规则。</td></tr>`;

  els.incomeRows.innerHTML = rowsOrEmpty(groupIncomeRows(monthIncomes).map(renderIncomeGroupRow), 4);

  els.invoiceRows.innerHTML = rowsOrEmpty(groupInvoiceRows(monthInvoices).map(renderInvoiceGroupRow), 7);

  els.expenseRows.innerHTML = rowsOrEmpty(groupExpenseRows(monthExpenses).map(renderExpenseGroupRow), 4);

  els.walletTransferRows.innerHTML = rowsOrEmpty(monthWalletTransfers.map((transfer) => `
    <tr>
      <td>${transfer.date}</td>
      <td>${escapeHtml(transfer.payee)}</td>
      <td>${escapeHtml(transfer.reference || "-")}</td>
      <td class="money">${formatMoney(transfer.amount)}</td>
    </tr>`), 4);

  const expenseTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const expenseByCategory = monthExpenses.reduce((groups, expense) => {
    const category = expense.category || "其他";
    groups[category] = (groups[category] || 0) + expense.amount;
    return groups;
  }, {});
  const expensePercentRows = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => {
      const percent = expenseTotal ? (amount / expenseTotal) * 100 : 0;
      return `
        <tr>
          <td>${escapeHtml(category)}</td>
          <td class="money">${formatMoney(amount)}</td>
          <td>${percent.toFixed(1)}%</td>
          <td><div class="percent-bar" style="--percent: ${Math.min(percent, 100).toFixed(1)}%"><span></span></div></td>
        </tr>`;
    });
  els.expensePercentRows.innerHTML = rowsOrEmpty(expensePercentRows, 4);

  const paymentsWithInvoices = monthPayments.map((payment) => ({
    payment,
    invoice: state.invoices.find((item) => item.id === payment.matchedInvoiceId) || null
  }));
  const waitingPayments = paymentsWithInvoices.filter(({ invoice }) => !invoice);
  const matchedPayments = paymentsWithInvoices.filter(({ invoice }) => invoice);
  els.pendingPaymentRows.innerHTML = rowsOrEmpty(waitingPayments.map(renderPaymentRow), 5);
  els.matchedPaymentRows.innerHTML = rowsOrEmpty(matchedPayments.map(renderPaymentRow), 5);

  const inventoryItems = Object.entries(state.inventory);
  const inventoryQuery = normalizeSearch(els.inventorySearch.value);
  const filteredInventory = inventoryQuery
    ? inventoryItems.filter(([, item]) => normalizeSearch(`${item.product} ${item.supplier}`).includes(inventoryQuery))
    : inventoryItems;

  els.inventorySearchStatus.textContent = inventoryQuery
    ? `找到 ${filteredInventory.length} / ${inventoryItems.length} 个产品`
    : `显示全部 ${inventoryItems.length} 个产品`;

  els.inventoryRows.innerHTML = rowsOrEmpty(filteredInventory.map(([key, item]) => {
    const calculator = state.costCalculators[key] || { total: "", divisor: "" };
    return `
      <tr>
        <td>${escapeHtml(item.product)}</td>
        <td class="money">${formatRecordMoney(item, item.latestCost)}</td>
        <td>
          <div class="cost-calculator">
            <input data-calc-key="${escapeHtml(key)}" data-calc-field="total" type="number" min="0" step="0.01" placeholder="总价" value="${escapeHtml(calculator.total || "")}" />
            <span>÷</span>
            <input data-calc-key="${escapeHtml(key)}" data-calc-field="divisor" type="number" min="1" step="1" placeholder="数量" value="${escapeHtml(calculator.divisor || "")}" />
            <strong data-calc-result="${escapeHtml(key)}">${formatMoney(calculateCostResult(calculator))}</strong>
          </div>
        </td>
        <td>${item.invoiceDate}</td>
        <td>${escapeHtml(item.supplier)}</td>
      </tr>`;
  }), 5);
}

function renderResult(parsed) {
  els.detectedType.textContent = typeLabel(parsed.type);
  els.generatePdfBtn.hidden = parsed.type !== "settlement_statement";
  if (parsed.type === "settlement_statement") {
    settlementDraft = parsed;
    renderSettlementResult(parsed);
    return;
  }
  if (parsed.type === "personal_expenses_batch") {
    renderExpenseBatchResult(parsed);
    return;
  }
  if (parsed.type === "transaction_batch") {
    renderTransactionBatchResult(parsed);
    return;
  }
  const fields = Object.entries(parsed)
    .filter(([key]) => !["items", "type", "id", "matchedInvoiceId", "receiptImage", "receiptImages"].includes(key))
    .filter(([key]) => !(key === "receiptFileName" && Array.isArray(parsed.receiptFileNames) && parsed.receiptFileNames.length))
    .map(([key, value]) => `<div class="summary-item"><span>${fieldLabel(key)}</span><strong>${formatValue(key, value, parsed)}</strong></div>`)
    .join("");
  const items = parsed.items?.length
    ? `<div class="line-items"><h3>产品明细</h3><div class="table-wrap"><table><thead><tr><th>产品</th><th>数量</th><th>单价</th><th>总额</th></tr></thead><tbody>${parsed.items.map((item) => `<tr><td>${escapeHtml(item.product)}</td><td>${item.qty}</td><td>${formatRecordMoney(parsed, item.unitPrice)}</td><td>${formatRecordMoney(parsed, item.total)}</td></tr>`).join("")}</tbody></table></div></div>`
    : "";
  els.resultBox.innerHTML = `<div class="summary-grid">${fields}</div>${items}`;
}

function renderTransactionBatchResult(parsed) {
  const rows = parsed.transactions?.length
    ? parsed.transactions.map((transaction, index) => `
      <tr>
        <td>${escapeHtml(transaction.date)}</td>
        <td>${escapeHtml(transaction.description)}</td>
        <td>${escapeHtml(transaction.reference || "-")}</td>
        <td class="money">${formatMoney(transaction.amount)}</td>
        <td>
          <select class="destination-select" data-transaction-destination="${index}">
            <option value="income" ${transaction.direction === "income" ? "selected" : ""}>进账</option>
            <option value="expense" ${transaction.direction === "expense" ? "selected" : ""}>个人支出</option>
            <option value="repayment" ${transaction.direction === "repayment" ? "selected" : ""}>还账</option>
            <option value="claim" ${transaction.direction === "claim" ? "selected" : ""}>等待认领</option>
          </select>
        </td>
        <td>
          <select class="destination-select" data-transaction-invoice="${index}">
            ${repaymentInvoiceOptions("自动匹配；没有发票就等待认领")}
          </select>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="6">暂无明细</td></tr>`;

  els.resultBox.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item"><span>类型</span><strong>多笔交易</strong></div>
      <div class="summary-item"><span>笔数</span><strong>${parsed.transactions?.length || 0}</strong></div>
      <div class="summary-item"><span>总金额</span><strong>${formatMoney(parsed.amount)}</strong></div>
      <div class="summary-item"><span>日期范围</span><strong>${escapeHtml(parsed.date)}</strong></div>
    </div>
    <div class="line-items">
      <h3>交易明细</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>日期</th><th>说明</th><th>Reference</th><th>金额</th><th>保存去向</th><th>还给哪家 Supplier / Invoice</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function renderExpenseBatchResult(parsed) {
  const rows = parsed.expenses?.length
    ? parsed.expenses.map((expense, index) => `
      <tr>
        <td>${escapeHtml(expense.date)}</td>
        <td>${escapeHtml(expense.merchant)}</td>
        <td><span class="chip">${escapeHtml(expense.category)}</span></td>
        <td class="money">${formatMoney(expense.amount)}</td>
        <td>
          <select class="destination-select" data-expense-destination="${index}">
            <option value="personal" selected>个人支出</option>
            <option value="materials">公司材料 / 库存</option>
            <option value="touchngo">Touch 'n Go 转账（不计支出）</option>
          </select>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="5">暂无明细</td></tr>`;

  els.resultBox.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item"><span>类型</span><strong>多笔个人支出</strong></div>
      <div class="summary-item"><span>笔数</span><strong>${parsed.expenses?.length || 0}</strong></div>
      <div class="summary-item"><span>总金额</span><strong>${formatMoney(parsed.amount)}</strong></div>
      <div class="summary-item"><span>日期范围</span><strong>${escapeHtml(parsed.date)}</strong></div>
    </div>
    <div class="line-items">
      <h3>个人支出明细</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>日期</th><th>商家</th><th>分类</th><th>金额</th><th>保存去向</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function renderSettlementResult(parsed) {
  const itemRows = (items) => items.length
    ? items.map((item) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td class="money">${formatMoney(item.amount)}</td>
        <td>${escapeHtml(item.note || "")}</td>
      </tr>`).join("")
    : `<tr><td colspan="3">暂无明细</td></tr>`;

  els.resultBox.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item"><span>我的公司</span><strong>${escapeHtml(parsed.myCompany)}</strong></div>
      <div class="summary-item"><span>对方公司</span><strong>${escapeHtml(parsed.otherCompany)}</strong></div>
      <div class="summary-item"><span>日期</span><strong>${escapeHtml(parsed.date)}</strong></div>
      <div class="summary-item"><span>欠款金额</span><strong>${formatMoney(parsed.owedAmount)}</strong></div>
    </div>
    <div class="settlement-grid">
      <div class="line-items">
        <h3>我拿的货：${escapeHtml(parsed.myCompany)}</h3>
        <div class="table-wrap"><table><thead><tr><th>内容</th><th>金额</th><th>备注</th></tr></thead><tbody>${itemRows(parsed.myItems)}</tbody></table></div>
        <p class="settlement-total">小计：${formatMoney(parsed.myTotal)}</p>
      </div>
      <div class="line-items">
        <h3>他拿的货：${escapeHtml(parsed.otherCompany)}</h3>
        <div class="table-wrap"><table><thead><tr><th>内容</th><th>金额</th><th>备注</th></tr></thead><tbody>${itemRows(parsed.otherItems)}</tbody></table></div>
        <p class="settlement-total">小计：${formatMoney(parsed.otherTotal)}</p>
      </div>
    </div>`;
}

function generateSettlementPdf() {
  if (!settlementDraft) {
    els.uploadStatus.textContent = "还没有可生成 PDF 的对账资料。请先识别对账照片。";
    els.uploadStatus.className = "upload-status warning";
    return;
  }

  const itemRows = (items) => items.length
    ? items.map((item) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td>${formatMoney(item.amount)}</td>
        <td>${escapeHtml(item.note || "")}</td>
      </tr>`).join("")
    : `<tr><td colspan="3">暂无明细</td></tr>`;

  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>对账 PDF - ${escapeHtml(settlementDraft.myCompany)} / ${escapeHtml(settlementDraft.otherCompany)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif; color: #14201d; }
          h1 { margin: 0 0 14px; font-size: 24px; }
          h2 { margin: 22px 0 8px; font-size: 16px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom: 18px; }
          .meta div { border: 1px solid #d9e3df; padding: 10px; border-radius: 6px; }
          .meta span { display: block; color: #64746e; font-size: 12px; font-weight: 700; }
          .meta strong { display: block; margin-top: 4px; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th, td { border: 1px solid #14201d; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #eef4f2; }
          td:nth-child(2), th:nth-child(2) { text-align: right; width: 28mm; }
          .total { margin: 8px 0 0; text-align: right; font-weight: 800; }
          .owed { margin-top: 26px; padding: 14px; border: 2px solid #14201d; text-align: right; font-size: 20px; font-weight: 900; }
        </style>
      </head>
      <body>
        <h1>双方拿货对账单</h1>
        <div class="meta">
          <div><span>日期</span><strong>${escapeHtml(settlementDraft.date)}</strong></div>
          <div><span>欠款总金额</span><strong>${formatMoney(settlementDraft.owedAmount)}</strong></div>
          <div><span>我拿的货 / 我的公司</span><strong>${escapeHtml(settlementDraft.myCompany)}</strong></div>
          <div><span>他拿的货 / 他的公司</span><strong>${escapeHtml(settlementDraft.otherCompany)}</strong></div>
        </div>
        <h2>我拿的货：${escapeHtml(settlementDraft.myCompany)}</h2>
        <table><thead><tr><th>内容</th><th>金额</th><th>备注</th></tr></thead><tbody>${itemRows(settlementDraft.myItems)}</tbody></table>
        <p class="total">小计：${formatMoney(settlementDraft.myTotal)}</p>
        <h2>他拿的货：${escapeHtml(settlementDraft.otherCompany)}</h2>
        <table><thead><tr><th>内容</th><th>金额</th><th>备注</th></tr></thead><tbody>${itemRows(settlementDraft.otherItems)}</tbody></table>
        <p class="total">小计：${formatMoney(settlementDraft.otherTotal)}</p>
        <div class="owed">最下面欠款金额：${formatMoney(settlementDraft.owedAmount)}</div>
        <script>window.addEventListener("load", () => window.print());</script>
      </body>
    </html>`;

  const win = window.open("", "_blank");
  if (!win) {
    els.uploadStatus.textContent = "浏览器阻止了 PDF 视窗。请允许弹出窗口后再试。";
    els.uploadStatus.className = "upload-status warning";
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function rowsOrEmpty(rows, colspan) {
  return rows.length ? rows.join("") : `<tr><td colspan="${colspan}">暂无记录</td></tr>`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function dateRangeLabel(records) {
  const dates = records.map((record) => record.date).filter(Boolean).sort();
  if (!dates.length) return new Date().toISOString().slice(0, 10);
  return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} - ${dates[dates.length - 1]}`;
}

function filterByMonth(records, dateKey) {
  return records.filter((record) => monthFromDate(record?.[dateKey]) === selectedMonth);
}

function monthFromDate(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : currentMonth();
}

function typeLabel(type) {
  return ({
    income: "进账",
    supplier_invoice: "Supplier Invoice",
    personal_expenses: "个人支出",
    personal_expenses_batch: "多笔个人支出",
    transaction_batch: "多笔交易",
    payment_proof: "Payment Proof",
    settlement_statement: "对账 PDF"
  })[type] || "等待识别";
}

function fieldLabel(key) {
  return ({
    supplier: "Supplier 名字",
    invoiceNo: "Invoice 编号",
    date: "日期",
    orderTime: "下单时间",
    currency: "币种",
    total: "总金额",
    paid: "已付款",
    status: "状态",
    merchant: "商家名称",
    category: "分类",
    amount: "金额",
    payer: "付款人",
    recipient: "收款人",
    reference: "Reference Number",
    receiptFileName: "单据照片",
    receiptFileNames: "单据照片"
  })[key] || key;
}

function formatValue(key, value, record = null) {
  if (["total", "paid", "amount"].includes(key)) return formatRecordMoney(record, value);
  if (key === "receiptFileNames" && Array.isArray(value)) return escapeHtml(value.join(", "));
  return escapeHtml(String(value));
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(value || 0));
}

function formatRecordMoney(record, value) {
  const currency = record?.currency || "MYR";
  if (currency === "CNY") {
    return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(Number(value || 0));
  }
  return formatMoney(value);
}

function formatOutflowMoney(value) {
  const amount = Math.abs(Number(value || 0));
  return formatMoney(amount === 0 ? 0 : -amount);
}

function formatOutflowCurrencyTotals(totals) {
  const entries = Object.entries(totals || {}).filter(([, value]) => Math.abs(Number(value || 0)) > 0.009);
  if (!entries.length) return formatMoney(0);
  return entries
    .sort(([left], [right]) => (left === "MYR" ? -1 : right === "MYR" ? 1 : left.localeCompare(right)))
    .map(([currency, value]) => formatRecordMoney({ currency }, -Math.abs(Number(value || 0))))
    .join(" / ");
}

function toMoney(value) {
  return Math.round(Number(String(value).replace(/,/g, "") || 0) * 100) / 100;
}

function sameMoney(left, right) {
  return Math.abs(toMoney(left) - toMoney(right)) < 0.01;
}

function sameDate(left, right) {
  return String(left || "") === String(right || "");
}

function meaningfulText(value) {
  const text = String(value || "").trim();
  return Boolean(text && text !== "-" && normalizeSearch(text) !== "unknown");
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function inventoryKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().trim();
}

function cleanValue(value) {
  return String(value).replace(/^(rm|myr)\s*/i, "").trim();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

initializeApp();

async function initializeApp() {
  registerServiceWorker();
  fixKnownUnknownSuppliers();
  rebuildInventoryFromInvoices();
  reapplyIncomeRules();
  reapplyExpenseRules();
  render();
  updateAuthUi();
  await restorePersistedAuthSession();
  await loadStateFromSupabase();
  refreshConfigStatus();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The app still works normally if PWA registration is unavailable.
    });
  });
}
