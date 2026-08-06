import { ProviderCatalogFlow } from '../../components/catalog/ProviderCatalogFlow';

export const GamePage = () => (
  <ProviderCatalogFlow
    category="game"
    title="Top Up Game"
    subtitle="Mobile Legends, Free Fire, PUBG, Valorant, dan provider game lain. Pilih game dulu, lalu produk."
    serviceName="Game"
    returnPath="/dashboard/game"
    targetMode="game"
    targetLabel="ID Game"
    targetPlaceholder="Masukkan User ID"
    secondaryLabel="Server / Zone ID"
    secondaryPlaceholder="Contoh: 1234 (opsional jika game tidak membutuhkan)"
  />
);
