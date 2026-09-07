import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { catalogService, Product } from '../../services/catalog.service';
import {
  voucherPhysicalBatchService,
  type VoucherPhysicalBatch,
  type VoucherPhysicalBatchItem,
} from '../../services/voucherPhysicalBatch.service';
import { useAuthStore } from '../../store/auth.store';
import { useFeaturesStore, selectPurchaseEnabled } from '../../store/features.store';
import { useWalletStore } from '../../store/wallet.store';
import {
  BrandLogo,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PinConfirmModal,
} from '../ui';
import { VoucherInternetProductList } from './VoucherInternetProductList';
import { colors, radius, spacing, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';
import { createIdempotencyKey } from '../../utils/idempotency';
import { operatorsMatch } from '../../utils/operatorMatch';
import { isCatalogListed, isProductPurchasable } from '../../utils/catalogAvailability';
import { physicalVoucherSnLimit } from '../../utils/physicalVoucherSnLimits';
import {
  collectTelkomselZoneLabels,
  filterProductsByZoneLabel,
  isTelkomselOperator,
  telkomselNationalProducts,
  telkomselNeedsZoneGate,
} from '../../utils/telkomselVoucherZone';
import {
  addCodesToScan,
  normalizeScanPayloadToSerial,
  removeScannedSerial,
  UNRECOGNIZED_SCAN_CODE_MESSAGE,
  validateSnInput,
  type ScannedSerial,
} from '../../utils/voucherPhysicalScan';
import { parseApiError } from '../../api/client';
import {
  VoucherPhysicalCameraScan,
  type CameraScanOutcome,
} from './VoucherPhysicalCameraScan';

/**
 * Voucher Internet — Fisik.
 * Flow: provider → (Telkomsel tipe) → (zona jika Per Wilayah) → SN → produk → review → PIN → batch.
 * Purchase: POST /voucher-internet/physical-batches (not POST /transactions).
 * PIN: PinConfirmModal local state only.
 */

type Props = {
  purchaseBanner?: string | null;
  onBack: () => void;
};

type Step = 'brands' | 'type' | 'zone' | 'scan' | 'products' | 'review' | 'result';
type PhysicalType = 'nasional' | 'perWilayah';
type ScanInputTab = 'camera' | 'manual';
type BrandRow = { name: string; count: number; logo: string | null };

const ITEM_STATUS_LABEL: Record<string, string> = {
  queued: 'Menunggu',
  processing: 'Diproses',
  success: 'Berhasil',
  failed: 'Gagal',
  refunded: 'Gagal',
};

const ZONE_WARN =
  'Kartu fisik berzona hanya aktif di wilayah tertentu. Pastikan SEMUA kartu yang kamu scan/input sesuai wilayah ini. Kartu yang salah wilayah akan gagal dan harus di-retry satu per satu.';

function isBackAction(action: { type: string }): boolean {
  return action.type === 'GO_BACK' || action.type === 'POP' || action.type === 'POP_TO_TOP';
}

function isBatchTerminal(batch: VoucherPhysicalBatch | null): boolean {
  return !!batch && (batch.status === 'completed' || batch.status === 'completed_with_failures');
}

export function VoucherInternetFisikFlow({ purchaseBanner, onBack }: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const purchaseEnabled = useFeaturesStore(selectPurchaseEnabled);
  const purchaseMessage = useFeaturesStore((s) => s.flags.messages.purchase);
  const overview = useWalletStore((s) => s.overview);
  const fetchWallet = useWalletStore((s) => s.fetchWallet);

  const [step, setStep] = useState<Step>('brands');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [brandQuery, setBrandQuery] = useState('');
  const [physicalType, setPhysicalType] = useState<PhysicalType | null>(null);
  const [zoneLabel, setZoneLabel] = useState<string | null>(null);

  const [rawSnInput, setRawSnInput] = useState('');
  const [scannedList, setScannedList] = useState<ScannedSerial[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [scanTab, setScanTab] = useState<ScanInputTab>('camera');
  const [manualEditIndex, setManualEditIndex] = useState<number | null>(null);
  const [manualEditValue, setManualEditValue] = useState('');
  const [manualEditError, setManualEditError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Product | null>(null);
  const [zoneAck, setZoneAck] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pinVisible, setPinVisible] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [batch, setBatch] = useState<VoucherPhysicalBatch | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogService.getProducts({ category: 'voucher-internet', per_page: 5000 });
      if (res.success && Array.isArray(res.data)) {
        setAllProducts(res.data.filter((p) => isCatalogListed(p)));
      } else {
        setAllProducts([]);
        setError(res.message || 'Gagal memuat katalog voucher internet.');
      }
    } catch (err: any) {
      setAllProducts([]);
      setError(err?.message || 'Gagal memuat katalog voucher internet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void fetchWallet();
  }, [load, fetchWallet]);

  const brands = useMemo((): BrandRow[] => {
    const map = new Map<string, BrandRow>();
    for (const p of allProducts) {
      const name = (p.operatorName || p.providerDetails?.name || 'Umum').trim();
      const prev = map.get(name);
      if (prev) prev.count += 1;
      else map.set(name, { name, count: 1, logo: p.providerDetails?.logo ?? null });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [allProducts]);

  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, brandQuery]);

  const brandProducts = useMemo(() => {
    if (!brand) return [];
    return allProducts
      .filter((p) => operatorsMatch(p.operatorName || p.providerDetails?.name, brand))
      .sort((a, b) => a.price - b.price);
  }, [allProducts, brand]);

  const telkomselActive = !!brand && isTelkomselOperator(brand) && brandProducts.length > 0;
  const brandNeedsType = telkomselActive && telkomselNeedsZoneGate(brandProducts);
  const zoneLabels = useMemo(
    () => (telkomselActive ? collectTelkomselZoneLabels(brandProducts) : []),
    [telkomselActive, brandProducts]
  );

  const snLimitKind = physicalType === 'perWilayah' ? 'perWilayah' : 'nasional';
  const snMax = physicalVoucherSnLimit(snLimitKind);
  const snDraftValidation = useMemo(() => validateSnInput(rawSnInput, snMax), [rawSnInput, snMax]);
  const atSnCapacity = scannedList.length >= snMax;

  const catalogProducts = useMemo(() => {
    if (!brand) return [];
    if (physicalType === 'perWilayah' && zoneLabel) {
      return filterProductsByZoneLabel(brandProducts, zoneLabel);
    }
    if (physicalType === 'nasional') {
      return telkomselNationalProducts(brandProducts);
    }
    // Non-Telkomsel / no type gate: full brand catalog
    if (!brandNeedsType) return brandProducts;
    return [];
  }, [brand, brandProducts, physicalType, zoneLabel, brandNeedsType]);

  const isZonalBatch = physicalType === 'perWilayah' && !!zoneLabel;
  const totalPayment = selected ? selected.price * scannedList.length : 0;
  const insufficientBalance =
    typeof overview?.wallet?.balance === 'number' && selected
      ? overview.wallet.balance < totalPayment
      : false;

  const terminal = isBatchTerminal(batch);
  const processedCount = batch
    ? batch.successCount + batch.failedCount + (batch.refundedCount || 0)
    : 0;

  useEffect(() => {
    if (!batch || terminal) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const res = await voucherPhysicalBatchService.getById(batch.id);
          if (res?.data) setBatch(res.data);
        } catch {
          // transient
        }
      })();
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [batch?.id, batch?.status, terminal]);

  useEffect(() => {
    if (terminal) {
      idempotencyKeyRef.current = null;
      void fetchWallet();
    }
  }, [terminal, fetchWallet]);

  const getOrCreateIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = createIdempotencyKey();
    return idempotencyKeyRef.current;
  };

  const resetAfterBrandChange = () => {
    setPhysicalType(null);
    setZoneLabel(null);
    setRawSnInput('');
    setScannedList([]);
    setSelected(null);
    setZoneAck(false);
    setScanError(null);
    setScanNotice(null);
    setScanTab('camera');
    setFormError(null);
    setSubmitError(null);
    setBatch(null);
    idempotencyKeyRef.current = null;
  };

  const goBackStep = useCallback(() => {
    if (pinVisible || pinLoading) return;
    if (step === 'result') return;
    if (step === 'review') {
      setStep('products');
      setZoneAck(false);
      setSubmitError(null);
      return;
    }
    if (step === 'products') {
      setSelected(null);
      setStep('scan');
      setFormError(null);
      return;
    }
    if (step === 'scan') {
      setRawSnInput('');
      setScannedList([]);
      setScanError(null);
      setScanNotice(null);
      setScanTab('camera');
      if (physicalType === 'perWilayah') {
        setStep('zone');
      } else if (brandNeedsType) {
        setStep('type');
      } else {
        setBrand(null);
        resetAfterBrandChange();
        setStep('brands');
      }
      return;
    }
    if (step === 'zone') {
      setZoneLabel(null);
      setStep('type');
      return;
    }
    if (step === 'type') {
      setBrand(null);
      resetAfterBrandChange();
      setStep('brands');
      return;
    }
    onBack();
  }, [step, onBack, pinVisible, pinLoading, physicalType, brandNeedsType]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!isBackAction(e.data.action)) return;
      if (step === 'result' || pinVisible || pinLoading) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      goBackStep();
    });
    return unsub;
  }, [navigation, goBackStep, step, pinVisible, pinLoading]);

  const openHelpWilayah = () => {
    router.push({ pathname: '/help/cek-zona', params: { provider: 'telkomsel' } });
  };

  const selectBrand = (name: string) => {
    setBrand(name);
    resetAfterBrandChange();
    const productsForBrand = allProducts.filter((p) =>
      operatorsMatch(p.operatorName || p.providerDetails?.name, name)
    );
    const needsType =
      isTelkomselOperator(name) &&
      productsForBrand.length > 0 &&
      telkomselNeedsZoneGate(productsForBrand);
    if (needsType) {
      setStep('type');
    } else {
      setPhysicalType('nasional');
      setStep('scan');
    }
  };

  const selectNasional = () => {
    setPhysicalType('nasional');
    setZoneLabel(null);
    setRawSnInput('');
    setScannedList([]);
    setScanError(null);
    setScanNotice(null);
    setScanTab('camera');
    setSelected(null);
    setZoneAck(false);
    setStep('scan');
  };

  const selectPerWilayah = () => {
    setPhysicalType('perWilayah');
    setZoneLabel(null);
    setRawSnInput('');
    setScannedList([]);
    setScanError(null);
    setScanNotice(null);
    setScanTab('camera');
    setSelected(null);
    setZoneAck(false);
    setStep('zone');
  };

  const selectZone = (label: string) => {
    setZoneLabel(label);
    setRawSnInput('');
    setScannedList([]);
    setScanError(null);
    setScanNotice(null);
    setScanTab('camera');
    setSelected(null);
    setZoneAck(false);
    setStep('scan');
  };

  const handleCameraDetected = useCallback(
    (serial: string): CameraScanOutcome => {
      // Defensive: camera already canonicalizes; keep shared path safe.
      const normalized = normalizeScanPayloadToSerial(serial);
      if (!normalized.ok) {
        setScanNotice(normalized.message || UNRECOGNIZED_SCAN_CODE_MESSAGE);
        setScanError(normalized.message || UNRECOGNIZED_SCAN_CODE_MESSAGE);
        return 'unrecognized';
      }

      let outcome: CameraScanOutcome = 'ignored';
      setScannedList((prev) => {
        const result = addCodesToScan(prev, [normalized.serial], snMax);
        if (result.unrecognized > 0 && result.added === 0 && result.duplicates === 0) {
          outcome = 'unrecognized';
          setScanNotice(UNRECOGNIZED_SCAN_CODE_MESSAGE);
          setScanError(UNRECOGNIZED_SCAN_CODE_MESSAGE);
          return prev;
        }
        if (result.atCapacity && result.added === 0) {
          outcome = 'at_capacity';
          setScanNotice('Batas SN sudah tercapai');
          return prev;
        }
        if (result.added > 0) {
          outcome = 'added';
          setScanNotice(result.noticeParts.length ? result.noticeParts.join(', ') + '.' : null);
          setScanError(null);
          return result.list;
        }
        if (result.duplicates > 0) {
          outcome = 'duplicate';
          return prev;
        }
        return prev;
      });
      return outcome;
    },
    [snMax]
  );

  const handleUnrecognizedScanCode = useCallback((message: string) => {
    setScanNotice(message);
    setScanError(message);
  }, []);

  const handleRemoveScanned = (serial: string) => {
    setScannedList((prev) => removeScannedSerial(prev, serial));
    setScanNotice(null);
    setScanError(null);
  };

  const handleEditScanned = (
    index: number,
    nextRaw: string
  ): { ok: true } | { ok: false; error: string } => {
    const normalized = normalizeScanPayloadToSerial(nextRaw);
    if (!normalized.ok) {
      return {
        ok: false,
        error:
          normalized.reason === 'empty'
            ? 'SN tidak boleh kosong.'
            : normalized.message || UNRECOGNIZED_SCAN_CODE_MESSAGE,
      };
    }
    const next = normalized.serial;
    const dup = scannedList.some((s, i) => i !== index && s.serial === next);
    if (dup) {
      return { ok: false, error: 'SN sudah ada di daftar. Perubahan tidak disimpan.' };
    }
    setScannedList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, serial: next } : item))
    );
    setScanError(null);
    return { ok: true };
  };

  const addManualDraftToList = () => {
    setScanError(null);
    setScanNotice(null);
    if (snDraftValidation.empty) {
      setScanError('Masukkan minimal 1 nomor seri voucher.');
      return;
    }
    if (snDraftValidation.duplicates.length > 0) {
      setScanError(snDraftValidation.duplicateMessages[0] || 'Terdapat SN duplikat.');
      return;
    }
    if (snDraftValidation.overLimit) {
      setScanError(`Maksimal ${snMax} SN untuk batch ini. Saat ini ${snDraftValidation.count} SN.`);
      return;
    }
    const result = addCodesToScan(scannedList, snDraftValidation.uniqueSerials, snMax);
    setScannedList(result.list);
    setRawSnInput('');
    if (result.noticeParts.length) {
      setScanNotice(result.noticeParts.join(', ') + '.');
    }
    if (result.atCapacity && result.added === 0) {
      setScanError('Batas SN sudah tercapai');
    }
  };

  const continueFromScan = () => {
    setScanError(null);
    let list = scannedList;

    if (rawSnInput.trim()) {
      if (snDraftValidation.duplicates.length > 0) {
        setScanError(snDraftValidation.duplicateMessages[0] || 'Terdapat SN duplikat.');
        return;
      }
      if (!snDraftValidation.empty) {
        if (snDraftValidation.overLimit && list.length === 0) {
          setScanError(`Maksimal ${snMax} SN untuk batch ini. Saat ini ${snDraftValidation.count} SN.`);
          return;
        }
        const result = addCodesToScan(list, snDraftValidation.uniqueSerials, snMax);
        list = result.list;
        setScannedList(list);
        setRawSnInput('');
        if (result.noticeParts.length) {
          setScanNotice(result.noticeParts.join(', ') + '.');
        }
      }
    }

    if (list.length === 0) {
      setScanError('Masukkan minimal 1 nomor seri voucher.');
      return;
    }
    if (list.length > snMax) {
      setScanError(`Maksimal ${snMax} SN untuk batch ini. Saat ini ${list.length} SN.`);
      return;
    }
    setSelected(null);
    setStep('products');
  };

  const selectProduct = (product: Product) => {
    if (!isProductPurchasable(product)) return;
    setSelected(product);
    setZoneAck(false);
    setFormError(null);
    setSubmitError(null);
    setStep('review');
  };

  const openPin = () => {
    setFormError(null);
    setSubmitError(null);
    if (!selected || !purchaseEnabled) return;
    if (!isProductPurchasable(selected)) {
      setFormError('Produk sedang tidak tersedia.');
      return;
    }
    if (scannedList.length === 0) {
      setFormError('Masukkan minimal 1 nomor seri voucher.');
      return;
    }
    if (isZonalBatch && !zoneAck) {
      setFormError('Centang konfirmasi wilayah sebelum lanjut.');
      return;
    }
    if (insufficientBalance) {
      setFormError('Saldo GurkyPay tidak mencukupi untuk batch ini.');
      return;
    }
    if (!user?.hasPin) {
      router.push('/akun/pin/create');
      return;
    }
    setPinError(null);
    setPinVisible(true);
  };

  const submitBatch = async (enteredPin: string) => {
    if (!selected || submittingRef.current) return;
    submittingRef.current = true;
    setPinLoading(true);
    setPinError(null);
    setSubmitError(null);
    try {
      const idempotencyKey = getOrCreateIdempotencyKey();
      const res = await voucherPhysicalBatchService.create({
        sku_code: selected.code,
        serials: scannedList.map((s) => ({
          serial_number: s.serial,
          scanned_at: s.scannedAt,
        })),
        pin: enteredPin,
        idempotency_key: idempotencyKey,
      });
      submittingRef.current = false;
      setPinLoading(false);
      setPinVisible(false);
      if (res?.data) {
        setBatch(res.data);
        setStep('result');
        void fetchWallet();
      } else {
        setSubmitError(res?.message || 'Gagal membuat batch voucher fisik.');
      }
    } catch (err: unknown) {
      submittingRef.current = false;
      setPinLoading(false);
      const parsed = parseApiError(err);
      const message = parsed.message || 'Gagal memproses batch voucher fisik.';
      if (/pin/i.test(message)) {
        setPinError(message);
      } else {
        setPinVisible(false);
        setSubmitError(message);
      }
    }
  };

  const handleRetryItem = async (item: VoucherPhysicalBatchItem) => {
    if (!batch || item.status !== 'failed') return;
    setRetryingId(item.id);
    try {
      await voucherPhysicalBatchService.retryItem(batch.id, item.id);
      const res = await voucherPhysicalBatchService.getById(batch.id);
      if (res?.data) setBatch(res.data);
    } catch {
      // stay failed
    } finally {
      setRetryingId(null);
    }
  };

  const finishResult = () => {
    setBatch(null);
    setBrand(null);
    resetAfterBrandChange();
    setStep('brands');
    onBack();
  };

  const typeLabel =
    physicalType === 'perWilayah' ? 'Per Wilayah' : physicalType === 'nasional' ? 'Nasional' : null;

  return (
    <View style={styles.wrap}>
      {purchaseBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{purchaseBanner}</Text>
        </View>
      ) : null}

      <Text style={styles.modeTag}>Voucher Fisik</Text>

      {loading && allProducts.length === 0 ? (
        <LoadingState label="Memuat voucher internet..." />
      ) : error && allProducts.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : step === 'brands' ? (
        <>
          <Text style={styles.lead}>Pilih Provider</Text>
          <Text style={styles.hint}>Pilih brand operator kartu fisik kamu.</Text>
          <TextInput
            value={brandQuery}
            onChangeText={setBrandQuery}
            placeholder="Cari provider..."
            placeholderTextColor={colors.gray[400]}
            style={styles.search}
          />
          {filteredBrands.length === 0 ? (
            <EmptyState title="Belum Ada Provider" message="Katalog voucher internet kosong." />
          ) : (
            <View style={styles.list}>
              {filteredBrands.map((b) => (
                <TouchableOpacity key={b.name} activeOpacity={0.7} onPress={() => selectBrand(b.name)}>
                  <Card style={styles.rowCard}>
                    <BrandLogo name={b.name} logo={b.logo} size={40} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{b.name}</Text>
                      <Text style={styles.rowMeta}>{b.count} produk</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      ) : step === 'type' ? (
        <>
          <Text style={styles.lead}>Pilih Tipe</Text>
          <Text style={styles.meta}>{brand}</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={selectNasional}>
            <Card style={styles.typeCard}>
              <Text style={styles.typeTitle}>Nasional</Text>
              <Text style={styles.typeDesc}>Berlaku di semua wilayah</Text>
              <Text style={styles.zoneMeta}>Maks. {physicalVoucherSnLimit('nasional')} SN / batch</Text>
            </Card>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={selectPerWilayah}>
            <Card style={styles.typeCard}>
              <Text style={styles.typeTitle}>Per Wilayah</Text>
              <Text style={styles.typeDesc}>Hanya aktif di zona tertentu</Text>
              <Text style={styles.zoneMeta}>Maks. {physicalVoucherSnLimit('perWilayah')} SN / batch</Text>
            </Card>
          </TouchableOpacity>
        </>
      ) : step === 'zone' ? (
        <>
          <Text style={styles.lead}>Pilih Wilayah</Text>
          <Text style={styles.meta}>
            {brand} · Per Wilayah
          </Text>

          <View style={styles.zoneWarnStrong}>
            <Ionicons name="warning" size={22} color={colors.status.pending} />
            <Text style={styles.zoneWarnStrongText}>{ZONE_WARN}</Text>
          </View>

          <Pressable onPress={openHelpWilayah} hitSlop={8}>
            <Text style={styles.helpLink}>Cara cek wilayah kartu</Text>
          </Pressable>

          <Text style={styles.section}>Pilih Wilayah</Text>
          {zoneLabels.length === 0 ? (
            <EmptyState
              title="Belum Ada Wilayah"
              message="Belum ada voucher tersedia untuk wilayah ini."
            />
          ) : (
            <View style={styles.list}>
              {zoneLabels.map((label) => {
                const count = filterProductsByZoneLabel(brandProducts, label).length;
                return (
                  <TouchableOpacity key={label} activeOpacity={0.7} onPress={() => selectZone(label)}>
                    <Card style={styles.zoneCard}>
                      <Text style={styles.zoneTitle} numberOfLines={2}>
                        {label}
                      </Text>
                      <Text style={styles.zoneMeta}>{count} produk</Text>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      ) : step === 'scan' ? (
        <>
          <Text style={styles.lead}>Input Serial Number</Text>
          <Text style={styles.meta}>
            {[brand, typeLabel, zoneLabel].filter(Boolean).join(' · ')}
          </Text>

          {isZonalBatch ? (
            <View style={styles.zoneWarnStrong}>
              <Ionicons name="warning" size={20} color={colors.status.pending} />
              <Text style={styles.zoneWarnStrongText}>{ZONE_WARN}</Text>
            </View>
          ) : null}

          <View style={styles.scanTabRow}>
            <TouchableOpacity
              style={[styles.scanTab, scanTab === 'camera' && styles.scanTabOn]}
              onPress={() => setScanTab('camera')}
              activeOpacity={0.7}
            >
              <Text style={[styles.scanTabText, scanTab === 'camera' && styles.scanTabTextOn]}>
                Scan Kamera
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scanTab, scanTab === 'manual' && styles.scanTabOn]}
              onPress={() => setScanTab('manual')}
              activeOpacity={0.7}
            >
              <Text style={[styles.scanTabText, scanTab === 'manual' && styles.scanTabTextOn]}>
                Input Manual
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.counter, atSnCapacity && styles.counterError]}>
            {scannedList.length}/{snMax} SN
          </Text>
          {atSnCapacity ? (
            <Text style={styles.error}>Batas SN sudah tercapai</Text>
          ) : null}
          {scanNotice ? <Text style={styles.notice}>{scanNotice}</Text> : null}

          {scanTab === 'manual' ? (
            <>
              <TextInput
                value={rawSnInput}
                onChangeText={(t) => {
                  setRawSnInput(t);
                  setScanError(null);
                }}
                placeholder={'Satu SN per baris, atau dipisah koma.\nContoh range: ABC001-ABC010'}
                placeholderTextColor={colors.gray[400]}
                style={[styles.search, styles.scanInput]}
                multiline
                autoCapitalize="characters"
                autoCorrect={false}
                textAlignVertical="top"
              />

              {snDraftValidation.duplicateMessages.map((msg) => (
                <Text key={msg} style={styles.error}>
                  {msg}
                </Text>
              ))}
              {snDraftValidation.overLimit ? (
                <Text style={styles.error}>
                  Melebihi batas {snMax} SN. Kurangi jumlah SN — tidak dipotong otomatis.
                </Text>
              ) : null}
              {scanError ? <Text style={styles.error}>{scanError}</Text> : null}

              <Button
                label="Tambahkan ke Daftar"
                variant="secondary"
                onPress={addManualDraftToList}
                disabled={snDraftValidation.empty || snDraftValidation.duplicates.length > 0}
              />

              {scannedList.length > 0 ? (
                <View style={styles.snListBox}>
                  <ScrollView style={styles.snListScroll} nestedScrollEnabled>
                    {scannedList.map((item, index) => (
                      <View key={`${item.serial}-${index}`} style={styles.snListRow}>
                        <TouchableOpacity
                          style={styles.snListMain}
                          onPress={() => {
                            setManualEditIndex(index);
                            setManualEditValue(item.serial);
                            setManualEditError(null);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.snListIndex}>{index + 1}.</Text>
                          <Text style={styles.snListSerial} numberOfLines={1}>
                            {item.serial}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleRemoveScanned(item.serial)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={18} color={colors.status.failed} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <Button
                label="Lanjut Pilih Produk"
                onPress={continueFromScan}
                disabled={scannedList.length === 0 && snDraftValidation.empty}
              />

              <Modal
                visible={manualEditIndex !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setManualEditIndex(null)}
              >
                <View style={styles.editBackdrop}>
                  <View style={styles.editSheet}>
                    <Text style={styles.editTitle}>Edit SN #{(manualEditIndex ?? 0) + 1}</Text>
                    <TextInput
                      value={manualEditValue}
                      onChangeText={(t) => {
                        setManualEditValue(t);
                        setManualEditError(null);
                      }}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      style={styles.editInput}
                    />
                    {manualEditError ? <Text style={styles.error}>{manualEditError}</Text> : null}
                    <Button
                      label="Simpan"
                      onPress={() => {
                        if (manualEditIndex === null) return;
                        const result = handleEditScanned(manualEditIndex, manualEditValue);
                        if (!result.ok) {
                          setManualEditError(result.error);
                          return;
                        }
                        setManualEditIndex(null);
                      }}
                    />
                    <Button
                      label="Batal"
                      variant="secondary"
                      onPress={() => setManualEditIndex(null)}
                    />
                  </View>
                </View>
              </Modal>
            </>
          ) : (
            <Text style={styles.hint}>
              Kamera terbuka penuh layar. Gunakan Input Manual jika izin ditolak atau kamera tidak
              tersedia.
            </Text>
          )}

          <VoucherPhysicalCameraScan
            visible={step === 'scan' && scanTab === 'camera'}
            list={scannedList}
            maxItems={snMax}
            scanningEnabled={!atSnCapacity}
            limitReached={atSnCapacity}
            notice={scanNotice}
            onDetected={handleCameraDetected}
            onUnrecognizedCode={handleUnrecognizedScanCode}
            onRemove={handleRemoveScanned}
            onEditSave={handleEditScanned}
            onConfirm={continueFromScan}
            onSwitchManual={() => setScanTab('manual')}
            onClose={() => setScanTab('manual')}
          />
        </>
      ) : step === 'products' ? (
        <>
          <Text style={styles.lead}>Pilih Produk</Text>
          <Text style={styles.meta}>
            {[brand, typeLabel, zoneLabel].filter(Boolean).join(' · ')} · {scannedList.length} SN
          </Text>
          {catalogProducts.length === 0 ? (
            <EmptyState
              title="Belum Ada Voucher"
              message="Belum ada voucher tersedia untuk wilayah ini."
            />
          ) : (
            <VoucherInternetProductList
              products={catalogProducts}
              onSelect={selectProduct}
              isDisabled={(p) => !isProductPurchasable(p)}
              getMetaLabel={(p) =>
                p.zoneLabel
                  ? p.zoneLabel
                  : physicalType === 'nasional'
                    ? 'Nasional'
                    : null
              }
            />
          )}
        </>
      ) : step === 'review' && selected ? (
        <>
          <Text style={styles.lead}>Konfirmasi Pembelian</Text>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Produk</Text>
              <Text style={styles.summaryValue}>{selected.name}</Text>
            </View>
            {isZonalBatch && zoneLabel ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Zona</Text>
                <Text style={styles.summaryValue}>{zoneLabel}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Jumlah kartu</Text>
              <Text style={styles.summaryValue}>{scannedList.length} SN</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Harga satuan</Text>
              <Text style={styles.summaryValue}>{formatIDR(selected.price)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatIDR(totalPayment)}</Text>
            </View>
          </Card>

          {isZonalBatch && zoneLabel ? (
            <View style={styles.finalWarn}>
              <Text style={styles.finalWarnText}>
                Kamu memilih {zoneLabel} dengan {scannedList.length} kartu. Transaksi ini tidak bisa
                dibatalkan setelah diproses.
              </Text>
              <Pressable
                onPress={() => setZoneAck((v) => !v)}
                style={styles.ackRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: zoneAck }}
              >
                <View style={[styles.checkbox, zoneAck && styles.checkboxOn]}>
                  {zoneAck ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                </View>
                <Text style={styles.ackText}>Saya sudah memastikan semua kartu sesuai wilayah</Text>
              </Pressable>
            </View>
          ) : null}

          {!purchaseEnabled ? <Text style={styles.notice}>{purchaseMessage}</Text> : null}
          {insufficientBalance ? (
            <Text style={styles.error}>Saldo GurkyPay tidak mencukupi untuk batch ini.</Text>
          ) : null}
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

          <Button
            label="Lanjutkan"
            onPress={openPin}
            disabled={
              !purchaseEnabled ||
              insufficientBalance ||
              pinLoading ||
              (isZonalBatch && !zoneAck)
            }
            loading={pinLoading}
          />
        </>
      ) : step === 'result' && batch ? (
        <>
          <Text style={styles.lead}>Hasil Aktivasi</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.status.success }]}>{batch.successCount}</Text>
              <Text style={styles.statLabel}>Berhasil</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.status.failed }]}>{batch.failedCount}</Text>
              <Text style={styles.statLabel}>Gagal</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{batch.totalSerials}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>

          {!terminal ? (
            <View style={styles.processingBanner}>
              <ActivityIndicator color={colors.primary[600]} />
              <Text style={styles.processingText}>
                Memproses {processedCount}/{batch.totalSerials} kartu — status diperbarui otomatis.
              </Text>
            </View>
          ) : null}

          {batch.invoiceNumber ? (
            <Text style={styles.hint}>Invoice: {batch.invoiceNumber}</Text>
          ) : null}

          <ScrollView style={styles.itemScroll} nestedScrollEnabled>
            <View style={styles.list}>
              {(batch.items || []).map((item) => {
                const icon =
                  item.status === 'success'
                    ? 'checkmark-circle'
                    : item.status === 'failed' || item.status === 'refunded'
                      ? 'close-circle'
                      : 'time';
                const iconColor =
                  item.status === 'success'
                    ? colors.status.success
                    : item.status === 'failed' || item.status === 'refunded'
                      ? colors.status.failed
                      : colors.status.pending;
                return (
                  <Card key={item.id} style={styles.itemRow}>
                    <Ionicons name={icon} size={20} color={iconColor} />
                    <View style={styles.rowBody}>
                      <Text style={styles.snText} numberOfLines={1}>
                        {item.serialNumber}
                      </Text>
                      <Text style={[styles.itemStatus, { color: iconColor }]}>
                        {ITEM_STATUS_LABEL[item.status] || item.status}
                      </Text>
                      {item.failureReason &&
                      (item.status === 'failed' || item.status === 'refunded') ? (
                        <Text style={styles.rowMeta} numberOfLines={2}>
                          {item.failureReason}
                        </Text>
                      ) : null}
                      {item.refundAmount != null && item.status === 'refunded' ? (
                        <Text style={styles.rowMeta}>Refund {formatIDR(item.refundAmount)}</Text>
                      ) : null}
                    </View>
                    {item.status === 'failed' ? (
                      <Pressable
                        onPress={() => void handleRetryItem(item)}
                        disabled={retryingId === item.id}
                      >
                        <Text style={styles.link}>
                          {retryingId === item.id ? '...' : 'Retry'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          </ScrollView>

          {terminal ? (
            <View style={styles.resultActions}>
              {batch.transactionId ? (
                <Button
                  label="Lihat Riwayat"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/riwayat/[id]',
                      params: { id: String(batch.transactionId) },
                    })
                  }
                />
              ) : null}
              <Button label="Selesai" onPress={finishResult} />
            </View>
          ) : null}
        </>
      ) : null}

      <PinConfirmModal
        visible={pinVisible}
        title="Konfirmasi PIN"
        subtitle="Masukkan 6 digit PIN untuk aktivasi voucher fisik"
        loading={pinLoading}
        error={pinError}
        dismissible={!pinLoading}
        onSubmit={(pin) => void submitBatch(pin)}
        onClose={() => {
          if (pinLoading) return;
          setPinVisible(false);
          setPinError(null);
        }}
        onEditing={() => setPinError(null)}
        onForgotPin={() => {
          setPinVisible(false);
          router.push('/akun/pin/forgot');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  banner: {
    backgroundColor: colors.status.pendingBg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bannerText: {
    fontSize: typography.size.xs,
    color: colors.gray[700],
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  modeTag: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  lead: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  meta: { fontSize: typography.size.xs, color: colors.gray[500] },
  hint: { fontSize: typography.size.xs, color: colors.gray[500], lineHeight: 18 },
  section: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  search: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.sm,
    color: colors.gray[900],
    fontWeight: typography.weight.medium,
  },
  scanInput: { minHeight: 140 },
  scanTabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scanTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
  },
  scanTabOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  scanTabText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[600],
  },
  scanTabTextOn: { color: colors.primary[700] },
  snListBox: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    backgroundColor: colors.gray[50],
    maxHeight: 180,
  },
  snListScroll: { maxHeight: 180 },
  snListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  snListMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  snListIndex: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    minWidth: 22,
  },
  snListSerial: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  editBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  editSheet: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  editTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  editInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  counter: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  counterError: { color: colors.status.failed },
  list: { gap: spacing.sm },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  rowMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
  price: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
  },
  disabled: { opacity: 0.55 },
  typeCard: { padding: spacing.lg, gap: 4 },
  typeTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  typeDesc: { fontSize: typography.size.sm, color: colors.gray[600] },
  zoneCard: { padding: spacing.md, gap: 4 },
  zoneTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  zoneMeta: { fontSize: typography.size.xs, color: colors.gray[500] },
  zoneWarnStrong: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: colors.status.pending,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  zoneWarnStrongText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.gray[900],
    lineHeight: 18,
    fontWeight: typography.weight.bold,
  },
  helpLink: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[700],
    textDecorationLine: 'underline',
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.status.failed,
    fontWeight: typography.weight.bold,
  },
  notice: {
    fontSize: typography.size.xs,
    color: colors.status.pending,
    fontWeight: typography.weight.medium,
  },
  summaryCard: { padding: spacing.lg, gap: spacing.sm },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  summaryLabel: { fontSize: typography.size.xs, color: colors.gray[500] },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.gray[900],
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[800],
  },
  totalValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
    color: colors.primary[700],
  },
  finalWarn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: colors.status.pending,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  finalWarnText: {
    fontSize: typography.size.xs,
    color: colors.gray[900],
    lineHeight: 18,
    fontWeight: typography.weight.bold,
  },
  ackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.gray[400],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  ackText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.gray[800],
    fontWeight: typography.weight.medium,
    lineHeight: 18,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  statNum: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
  },
  statLabel: { fontSize: 10, color: colors.gray[500], marginTop: 2 },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.pendingBg,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  processingText: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.status.pending,
    fontWeight: typography.weight.medium,
  },
  itemScroll: { maxHeight: 300 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  snText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.gray[800],
  },
  itemStatus: {
    fontSize: 10,
    fontWeight: typography.weight.black,
    textTransform: 'uppercase',
  },
  link: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary[600],
  },
  resultActions: { gap: spacing.sm },
});
