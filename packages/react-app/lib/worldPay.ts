import type { PurchaseKind } from "@/lib/paymentAmounts"
import {
    getPaymentAmount,
    getPaymentDescription
} from "@/lib/paymentAmounts"
import { miniKitPay } from "@/lib/miniKitPay"

export async function runWorldPayment(
    kind: PurchaseKind
): Promise<string> {
  return miniKitPay(
      getPaymentAmount(kind),
      getPaymentDescription(kind)
  )
}
