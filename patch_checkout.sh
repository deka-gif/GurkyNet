sed -i '/const finalizeTransaction = async () => {/,/  };/c\
  const finalizeTransaction = async () => {\
    setLoadingStatus("Mengirim permintaan ke server...");\
    \
    const requestPayload = {\
      sku_code: data.skuCode || "",\
      target_number: data.targetNo,\
      pin: pin,\
      admin_fee: data.adminFee\
    };\
\
    const trx = await createTransaction(requestPayload);\
    if (trx) {\
      setCreatedTrx(trx);\
      setFinalStatus(trx.status || "sukses");\
      setStep("RESULT");\
      \
      try {\
        const receiptRes = await transactionService.getReceipt(trx.id || trx.invoice_number);\
        if (receiptRes.success && receiptRes.data) {\
          setReceiptData(receiptRes.data);\
        }\
      } catch (err) {\
        console.error("Failed to fetch receipt:", err);\
      }\
\
      if (onSuccess) {\
        onSuccess(trx);\
      }\
      fetchWallet();\
    } else {\
      const state = useTransactionStore.getState();\
      const errorMessage = state.error || "Gagal membuat transaksi.";\
      let fullMessage = errorMessage;\
      if (state.validationErrors) {\
        const vals = Object.values(state.validationErrors).flat().join(", ");\
        if (vals) {\
           fullMessage += ` - ${vals}`;\
        }\
      }\
      setFinalStatus("gagal");\
      setCreatedTrx({ invoice_number: "TRX-GAGAL", note: fullMessage });\
      setStep("RESULT");\
    }\
  };' src/components/CheckoutSummary.tsx
