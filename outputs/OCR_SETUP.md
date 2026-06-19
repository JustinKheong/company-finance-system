# OCR Setup

This app now has a Node backend with an `/api/ocr` endpoint.

## Start with OpenAI OCR

Create a local `.env` file in this same folder:

```bash
cp .env.example .env
```

Edit `.env` and replace `sk-your-key-here` with your real OpenAI API key.

Then start:

```bash
cd /Users/justinkheong/Documents/Codex/2026-06-14/dashboard-invoice-ai-ocr-supplier-invoice/outputs
node server.mjs
```

Then open:

```text
http://localhost:4173/
```

## Optional model override

```bash
OPENAI_MODEL=gpt-5.5 node server.mjs
```

## How it works

1. Upload an invoice photo.
2. Choose `出账`.
3. Click `识别并记录`.
4. The browser sends the image to `/api/ocr`.
5. The backend sends it to OpenAI Vision.
6. OpenAI returns structured JSON.
7. The app records the Supplier Invoice and updates Inventory latest cost.

For income receipts, choose `进账`; the OCR result is recorded as income and added to cash on hand.
