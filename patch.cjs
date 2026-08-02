const fs = require('fs');
let code = fs.readFileSync('src/components/CheckoutSummary.tsx', 'utf8');

const startStr = '{/* PREMIUM RECEIPT COMPONENT */}';
const endStr = '{/* ACTIONS FOOTER */}';
const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `            {/* PREMIUM RECEIPT COMPONENT */}
            <div id="printable-receipt" className="p-6 space-y-6">
              {receiptData ? (
                <>
                  <div className="flex justify-between items-start border-b border-dashed border-gray-200 pb-5">
                    <div>
                      <h4 className="text-lg font-black text-gray-900 tracking-tight">{receiptData.header?.company_name || 'GURKYPAY'}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-0.5">Bukti Pembayaran Resmi</p>
                    </div>
                    <div className="text-right">
                      <span className={\`text-[10px] font-black uppercase px-2.5 py-1 rounded-full \${
                        receiptData.transaction_details?.status === 'success' || receiptData.transaction_details?.status === 'sukses' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        receiptData.transaction_details?.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-red-50 text-red-700 border border-red-100'
                      }\`}>
                        {receiptData.transaction_details?.status || finalStatus}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Nomor Invoice</span>
                      <span className="font-black text-gray-800 tracking-wide">{receiptData.transaction_details?.invoice_number}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Tanggal</span>
                      <span className="font-black text-gray-800">
                        {receiptData.transaction_details?.date 
                          ? new Date(receiptData.transaction_details.date).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                          : '-'}
                      </span>
                    </div>
                    {receiptData.transaction_details?.serial_number && (
                      <div className="flex justify-between items-center text-xs bg-emerald-50/50 p-2 rounded border border-emerald-100">
                        <span className="font-bold text-emerald-600 uppercase tracking-wider text-[10px]">Serial Number (SN)</span>
                        <span className="font-black text-emerald-700 tracking-wide">{receiptData.transaction_details.serial_number}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Kategori</span>
                      <span className="font-black text-gray-800">{receiptData.transaction_details?.service_name}</span>
                    </div>
                    
                    {receiptData.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start text-xs gap-4">
                        <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Produk</span>
                        <span className="font-black text-gray-800 text-right">{item.name}</span>
                      </div>
                    ))}

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Nomor Target</span>
                      <span className="font-black text-gray-800 tracking-wider">{receiptData.transaction_details?.target_number}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Metode Pembayaran</span>
                      <span className="font-black text-primary-600">{receiptData.transaction_details?.payment_method}</span>
                    </div>

                    <div className="border-t border-dashed border-gray-200 pt-3.5 space-y-2.5">
                      <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                        <span>Harga</span>
                        <span className="text-gray-900">{formatIDR(receiptData.payment_summary?.subtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                        <span>Admin</span>
                        <span className="text-gray-900">{formatIDR(receiptData.payment_summary?.admin_fee || 0)}</span>
                      </div>
                      <div className="border-t border-dashed border-gray-100 pt-2.5 flex justify-between items-center">
                        <span className="text-xs font-black text-gray-900 uppercase">Total Bayar</span>
                        <span className="text-lg font-black text-primary-600">{formatIDR(receiptData.payment_summary?.total_payment || 0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-5 flex flex-col items-center text-center space-y-2.5">
                    <div className="p-2 bg-white border border-gray-150 rounded-xl">
                      <div className="w-20 h-20 bg-gray-50 flex items-center justify-center text-gray-400 relative">
                        <QrCode className="w-14 h-14" />
                        <span className="absolute bottom-1 text-[7px] text-gray-300 font-extrabold tracking-widest uppercase">GURKYPAY QR</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold max-w-xs leading-normal">
                      {receiptData.footer?.note || 'Terima kasih telah menggunakan GurkyPay.'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-gray-400 min-h-[300px]">
                  <RefreshCw className="w-8 h-8 animate-spin mb-3 text-primary-500" />
                  <span className="text-xs font-bold">Membuat struk resmi...</span>
                </div>
              )}
            </div>

            `;
  
  const newCode = code.substring(0, startIdx) + replacement + code.substring(endIdx);
  fs.writeFileSync('src/components/CheckoutSummary.tsx', newCode);
  console.log("Patched successfully");
} else {
  console.log("Could not find delimiters");
}
