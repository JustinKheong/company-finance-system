# Loyverse sync flow

This document records the required Loyverse timing and approval rules for future phases. It is a product and engineering guardrail only; Phase 1 must not connect to the real Loyverse API.

## 1. Read phase

- After the API connection is configured successfully, the system may read Loyverse products.
- The read should include product name, Item ID, Variant ID, SKU, and Barcode.
- The product catalog can be saved or cached for invoice matching.
- Reading Loyverse products must not modify Loyverse data.

## 2. Invoice processing phase

- Staff uploads a supplier invoice in Company POS.
- OCR extracts product names, quantities, costs, supplier, and invoice date.
- The system searches Loyverse candidate products.
- Staff selects the correct candidate products and submits them for owner review.
- At this point the system only saves the invoice, inventory, cost history, and matching suggestions.
- The system must not update Loyverse during invoice processing.

## 3. Owner confirmation phase

Head Office must show these actions for the owner:

- Return for correction
- Save inventory only
- Confirm cost and update Loyverse

Only the owner action "Confirm cost and update Loyverse" may call the Loyverse write API.

Before calling the write API, the owner must see:

- Loyverse original name
- Suggested new name
- Item ID / Variant ID
- Old cost
- New cost
- Supplier
- Invoice date

After the update attempt, save:

- Sync status
- Updated by
- Updated at
- Old value
- New value
- API response
- Error message

## 4. Pricing channel separation

WooCommerce and BigSeller price sync are separate owner confirmation steps.

Updating Loyverse cost or product naming must not automatically update WooCommerce or BigSeller selling prices.
