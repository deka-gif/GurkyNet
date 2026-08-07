import { motion } from 'motion/react';
import { Star, ShoppingBag } from 'lucide-react';
import { useWebsiteStore } from '../../store/website.store';
import { formatIDR } from '../../utils/currency';
import { catalogStatusLabel, isProductPurchasable } from '../../utils/catalogAvailability';

export const FeaturedProducts = (_props: { section?: import('../../types').HomepageSection } = {}) => {
  const { featuredProducts } = useWebsiteStore();

  if (!featuredProducts.length) {
    return null;
  }

  return (
    <section id="featured-products" className="py-20 md:py-28 bg-white">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider mb-4 border border-amber-100">
            <Star className="w-3.5 h-3.5" />
            Produk Unggulan
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
            Pilihan Terbaik dari <span className="text-primary-600">Marketing</span>
          </h2>
          <p className="text-base md:text-lg text-gray-600 leading-relaxed">
            Produk yang paling sering dipilih pelanggan dan diprioritaskan untuk tampil di homepage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product, index) => (
            <motion.div
              key={`${product.code}-${index}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="rounded-3xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-primary-200 hover:shadow-xl hover:shadow-primary-500/5 p-6 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-primary-600 mb-2">
                {product.operatorName || product.category}
              </div>
              <h3 className="text-base font-black text-gray-900 leading-tight mb-2">
                {product.name}
              </h3>
              <p className="text-xs text-gray-500 mb-5">
                Kategori: <span className="font-bold text-gray-700">{product.category}</span>
              </p>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Harga</div>
                  <div className="text-lg font-black text-primary-600">{formatIDR(Number(product.price))}</div>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                  isProductPurchasable(product as any)
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : catalogStatusLabel(product as any) === 'Maintenance'
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-red-50 text-red-700 border-red-100'
                }`}>
                  {catalogStatusLabel(product as any)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
